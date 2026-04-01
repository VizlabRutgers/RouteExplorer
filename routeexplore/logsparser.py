import itertools
import os
import sys

from collections import defaultdict


TIMESTAMP_PRESICION=9


class LogsParser:
    def __init__(self, tagdir):
        self._node_to_ip = os.path.join(tagdir, 'nodetoip.csv')
        self._ft_file = os.path.join(tagdir, 'forwardingtables.csv')
        self._pos_file = os.path.join(tagdir, 'positions.csv')
        self._rt_file = os.path.join(tagdir, 'routes.csv')
        self._tx_file = os.path.join(tagdir, 'tx.csv')
        self._rx_file = os.path.join(tagdir, 'rx.csv')
        self._flow_file = os.path.join(tagdir, 'flows.csv')


    def parse(self, rfile, route_timestep):
        last_t_nsec = None
        last_sec = None
        nodes = set()
        ip_to_node = {}
        node_to_ip = {}

        t_ftable = defaultdict(lambda:{})

        fwfd = open(self._ft_file, 'w')
        pfd = open(self._pos_file, 'w')
        txfd = open(self._tx_file, 'w')
        rxfd = open(self._rx_file, 'w')
        flowfd = open(self._flow_file, 'w')

        """
        Paths, Node Positions, Transmit and Receive Time for
        packets will be either calculated or rounded to the
        nearest microsecond. However we don't want to lose precision
        unnecessarily for calulations like node positions and latency
        so:

        1. For packets, calculate the latency from floating point numbers
           (before rounding tx and rx time). Store tx time and rx time
           as microseconds in table but latency (in rx table) as real.
        2. For positions, calculate positions at the t_nsec time from
           the real position waypoint data and store positions in the
           table at the nsec time.
        3. For paths having paths at every microsecond is too much.
           In reality even 10msec is too much. So we want to have
           path values at all of the packet tx and rx times, but
           also at (for now) 100nsec points as a framework. This way
           our paths table with have path entries at every 100nsec steop
           and exactly for packet tx and rx times. It may be we want
           to revisit this later and have a finer grid just over times
           where an active flow exists.
        """
        multiplier = 10**TIMESTAMP_PRESICION

        flows = defaultdict(lambda:[])
        positions = {}
        txs = {}
        tx_rx_times = set()

        try:
            for i,line in enumerate(open(rfile), start=1):
                toks = line.strip().split(',')

                if toks[0] == 'node':
                    self.add_node(toks, ip_to_node, node_to_ip, nodes)
                    continue
                elif toks[0] == 'flow':
                    flows = self.add_flow(toks, multiplier, flowfd, flows)

                if len(toks) < 3:
                    print(f'Unexpected line {i}: "{line}".', file=sys.stderr)
                    continue

                t_nsec = round(float(toks[1]) * multiplier)

                if not t_nsec == last_t_nsec:
                    if last_t_nsec:
                        self.write_forwarding_step(last_t_nsec, t_ftable, fwfd)
                    last_t_nsec = t_nsec

                    t_sec = t_nsec//multiplier
                    if not t_sec == last_sec:
                        print(f'\rt={t_sec}', end='')
                    last_sec = t_sec

                if toks[0] == 'route':
                    self.add_forwarding_entry(t_ftable, toks, ip_to_node)

                elif toks[0] == 'pos':
                    self.add_position(toks, multiplier, positions)

                elif toks[0] == 'tx':
                    #/NodeList/10/ApplicationList/0/$ns3::OnOffApplication/TxWithSeqTsSize
                    self.write_tx(t_nsec, toks, ip_to_node, txfd, txs)
                    tx_rx_times.add(t_nsec)

                elif toks[0] == 'rx':
                    #/NodeList/10/ApplicationList/0/$ns3::OnOffApplication/TxWithSeqTsSize
                    ctx_toks = toks[2].split('/')
                    node_num = int(ctx_toks[2])
                    app_num = int(ctx_toks[4])
                    self.write_rx(t_nsec, toks, ip_to_node, rxfd, txs)
                    tx_rx_times.add(t_nsec)

            # we write positions out of the loop because ns3 seems the trace seems to
            # print duplicate lines for the same timepoint and node. The first one prints
            # vx,vy,vz all set to 0. A second trace then sets non-zero velocity. Perhaps
            # should be fixed upstream in traces.
            self.write_positions(pfd, positions)

        finally:
            fwfd.close()
            pfd.close()
            txfd.close()
            rxfd.close()

        with open(self._node_to_ip, 'w') as fd:
            for (node_num,ifc_num),ip in sorted(node_to_ip.items()):
                fd.write(f'{node_num},{ifc_num},{ip}\n')

        print()
        print('compute and write paths')
        self.compute_and_write_paths(route_timestep, tx_rx_times, flows, nodes)
        print('done')


    def add_node(self, node_toks, ip_to_node, node_to_ip, nodes):
        # node,0,1,10.1.1.1,255.255.255.0
        _,node_num,ifc_num,ip,_ = node_toks
        if ip == '127.0.0.1':
            return
        ip_to_node[ip] = (int(node_num),int(ifc_num))
        node_to_ip[(int(node_num),int(ifc_num))] = ip
        nodes.add(int(node_num))


    def add_flow(self, toks, multiplier, flowfd, flows):
        # 10 0 100615000000 200000000000
        print(toks)
        src_node,dst_node = tuple(map(int, toks[1:3]))
        print(f'add_flow {src_node} {dst_node}')
        start_t_nsec,stop_t_nsec = tuple(map(lambda x: round(float(x) * multiplier), toks[3:]))
        print('add_flow 2')
        flowfd.write(f'{src_node},{dst_node},{start_t_nsec},{stop_t_nsec}\n')
        flows[(src_node,dst_node)].append((start_t_nsec, stop_t_nsec))
        return flows


    def add_forwarding_entry(self, t_ftable, toks, ip_to_node):
        node_num = int(toks[2].split('/')[2])
        action = toks[3]

        if len(toks) == 4 and action == 'clear':
            t_ftable[node_num] = {}
            return

        if len(toks) < 8:
            print(f'Unexpected line {i}, quitting.')
            exit(3)

        dst = toks[4]
        hop = toks[5]
        ifc_num = int(toks[6])
        hops = int(toks[7])

        if action == 'remove':
            t_ftable[node_num].pop(ip_to_node[dst], None)
        else:
            t_ftable[node_num][ip_to_node[dst]] = (ip_to_node[hop],ifc_num,hops)


    def add_position(self, toks, multiplier, positions):
        # pos,191.274,/NodeList/15/$ns3::MobilityModel/CourseChange,110.905,1204.3,0
        t = round(float(toks[1]) * multiplier)
        node_num = int(toks[2].split('/')[2])
        x,y,z,vx,vy,vz = tuple(map(float, toks[3:]))
        positions[(t,node_num)] = (x,y,z,vx,vy,vz)


    def write_positions(self, pfd, positions):
        for (t,node_num),(x,y,z,vx,vy,vz) in sorted(positions.items()):
            pfd.write(f'{t},{node_num},{x:0.6f},{y:0.6f},{z:0.6f},{vx:0.6f},{vy:0.6f},{vz:0.6f}\n')


    def compute_and_write_paths(self, route_timestep, tx_rx_times, flows, nodes):
        paths = defaultdict(lambda: defaultdict(lambda: {}))

        last_t_nsec = None
        last_t_dsec = -route_timestep
        step_forwarding_table = defaultdict(lambda: defaultdict(lambda: {}))

        with open(self._ft_file) as ftfd:
            with open(self._rt_file, 'w') as rtfd:
                for line in ftfd:
                    toks = line.strip().split(',')

                    t_nsec = int(toks[0])
                    t_dsec = int(t_nsec)//route_timestep * route_timestep
                    node = int(toks[1])
                    entries = toks[2:]

                    while (last_t_dsec+route_timestep) <= t_dsec:
                        # repeat route state at each route_timestep point, just repeating
                        # route state as needed. this seems to be needed towards the beginning
                        # of the scenario where there are large jumps in time.
                        last_t_dsec += route_timestep
                        self.write_paths(rtfd, last_t_dsec, step_forwarding_table, flows, nodes)
                        if last_t_dsec in tx_rx_times:
                            tx_rx_times.remove(last_t_dsec)

                    node = int(node)
                    for entry_tok in entries:
                        dst,hop,hops = tuple(map(int, entry_tok.split('-')))
                        step_forwarding_table[node][dst] = (hop,hops)


    def write_paths(self, rtfd, t_nsec, step_forwarding_table, flows, nodes):
        print(f'write_paths {t_nsec:09}')
        paths = defaultdict(lambda: defaultdict(lambda: []))

        all_pairs = set(itertools.permutations(nodes, 2))

        for node,forwarding_table in sorted(step_forwarding_table.items()):
            for dst,(hop,_) in forwarding_table.items():
                if node==dst:
                    print(f'{t_nsec} ignoring self route {node}->{dst}')
                    continue

                # track source/destinatino pairs with no initial route entry to be
                # marked as "noroute" below.
                all_pairs.remove((node,dst))

                loop = False
                path = [hop]
                done = hop == dst
                flow_extents = flows.get((node,dst), [])
                active = any(filter(lambda x: t_nsec>=x[0] and t_nsec<=x[1], flow_extents))

                while not done and not loop:
                    hop_forwarding_table = step_forwarding_table[hop]
                    hop_hops = hop_forwarding_table.get(dst, None)

                    if hop_hops:
                        hop,_ = hop_hops
                        if hop in path:
                            loop = True
                        elif hop == dst:
                            done = True
                        path.append(hop)
                    else:
                        break

                first_hop = path[0]

                path_str = '-'.join(map(str,path))

                if loop:
                    rtfd.write(f'{t_nsec},{node},{dst},{path_str},loop,{active}\n')
                elif done:
                    rtfd.write(f'{t_nsec},{node},{dst},{path_str},valid,{active}\n')
                else:
                    rtfd.write(f'{t_nsec},{node},{dst},{path_str},incomplete,{active}\n')

        for node,dst in sorted(all_pairs):
            flow_extents = flows.get((node,dst), [])
            active = any(filter(lambda x: t_nsec>=x[0] and t_nsec<=x[1], flow_extents))
            rtfd.write(f'{t_nsec},{node},{dst},,noroute,{active}\n')

    def write_forwarding_step(self, t, t_ftable, fwfd):
        for node,entries in sorted(t_ftable.items()):
            if not entries:
                continue
            entry_tok = ','.join([f'{dst[0]}-{hop[0]}-{hops}' for dst,(hop,_,hops) in sorted(entries.items())])
            fwfd.write(f'{t},{node},{entry_tok}\n')


    def write_tx(self, t_nsec, toks, ip_to_node, txfd, txs):
        # tx,199.8648531,/NodeList/10/ApplicationList/0/$ns3::OnOffApplication/TxWithSeqTsSize,10.1.1.1,396,64
        ctx_toks = toks[2].split('/')
        src_node_num = int(ctx_toks[2])
        src_app_num = int(ctx_toks[4])
        dstip = toks[3]
        seq,pktsize = list(map(int,toks[4:]))
        dst_node_num = ip_to_node[dstip][0]
        key = (src_node_num,seq,dst_node_num)
        txs[key] = (t_nsec,src_app_num)
        txfd.write(f'{t_nsec},{src_node_num},{src_app_num},{dst_node_num},{seq},{pktsize}\n')


    def write_rx(self, t_nsec, toks, ip_to_node, rxfd, txs):
        # rx,198.7909641,/NodeList/8/ApplicationList/0/$ns3::PacketSink/RxWithSeqTsSize,10.1.1.19,391,64
        ctx_toks = toks[2].split('/')
        dst_node_num = int(ctx_toks[2])
        dst_app_num = int(ctx_toks[4])
        srcip = toks[3]
        seq,pktsize = list(map(int,toks[4:]))
        src_node = ip_to_node[srcip][0]
        key = (src_node,seq,dst_node_num)
        tx_t_nsec,src_app_num = txs[key]
        latency = t_nsec - tx_t_nsec
        print(key,t_nsec,tx_t_nsec,latency)
        rxfd.write(f'{t_nsec},{dst_node_num},{dst_app_num},{src_node},{src_app_num},{seq},{pktsize},{latency}\n')
