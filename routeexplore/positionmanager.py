import copy
import math
import sys
from collections import defaultdict

from routeexplore.consts import DEFAULT_MAX_EDGE_DISTANCE

import sqlite3
import pandas as pd


class PositionManager:
    def __init__(self, sqlitefile):
        self._sqlitefile = sqlitefile

        con = sqlite3.connect(sqlitefile)

        pos_df = pd.read_sql('select * from positions', con)

        self._nodes = list(map(int, sorted(pos_df.node.unique())))

        self._t_nsecs = pos_df.t_nsec.unique()

        self._num_positions = len(self._t_nsecs)

        self._min_p = (pos_df.x.min(), pos_df.y.min(), pos_df.z.min())
        self._max_p = (pos_df.x.max(), pos_df.y.max(), pos_df.z.max())

        self._max_edge_distance = DEFAULT_MAX_EDGE_DISTANCE

        self._cc_counts_by_time,self._cc_change_times = self._count_ccs(con)

    @property
    def get_nodes(self):
        return self._nodes

    def cc_counts_by_time(self, t_index):
        t_nsec = self._t_nsecs[t_index]
        return self._cc_counts_by_time[t_nsec]

    @property
    def cc_change_times(self):
        return self._cc_change_times


    def get_positions_by_cc_and_node_order(self, t_index):
        if t_index < 0:
            return []
        if t_index >= self._num_positions:
            return []
        t_nsec = self._t_nsecs[t_index]

        con = sqlite3.connect(self._sqlitefile)

        ccs = pd.read_sql(f'select node,cc_num from connected_components where t_nsec=={t_nsec}', con)

        ccs.set_index('node', inplace=True)

        positions = []

        positions_by_cc = defaultdict(lambda: [])

        matrix_order = []

        for _,n,x,y,z in con.execute(f'select * from positions where t_nsec=={t_nsec}').fetchall():
            # need explicit int call here because cc_num is an numpy.int64 which causes an
            # error when the caller tries to convert to json
            cc_num = int(ccs.loc[n].cc_num)

            positions_by_cc[cc_num].append((n,x,y,z))

            matrix_order.append((y,cc_num,x,n))

        # sort nodes by cc_num and then x value
        node_order = [0] * len(matrix_order)

        i = 0
        for tpl in sorted(matrix_order):
            y,cc_num,x,n = tpl
            # TODO - sorting by y works here because of the long narrow
            # geometry of the scenario layout - y is the long access.
            # By contrast, making x the first factor leads to a much
            # less compact matrix route representation. Some sort
            # of k-group general partitioning seems like a cool ideay
            # here.
            #print(y,cc_num,x,n)

            node_order[n] = i
            i += 1

        return positions_by_cc, node_order


    def get_edges(self, t_index):
        t_nsec = self._t_nsecs[t_index]

        #if t_nsec in self._edges_cache:
        #    return self._edges_cache[t_nsec]

        edges = []

        con = sqlite3.connect(self._sqlitefile)

        rows = con.execute(f'select * from positions where t_nsec=={t_nsec}').fetchall()

        for r1 in rows:
            _,n1,x1,y1,z1 = r1

            for r2 in rows[1:]:
                _,n2,x2,y2,z2 = r2
                d = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
                if d <= self._max_edge_distance:
                    edges.append((n1,n2))

        #self._edges_cache[t_index] = edges

        return edges


    @property
    def get_space_range(self):
        return self._min_p,self._max_p


    def _count_ccs(self, con):
        cc_counts_by_time = {}
        cc_counts_by_time_list = []
        cc_change_times = []

        ccs = pd.read_sql(f'select t_nsec,cc_num from connected_components', con)

        last_t_nsec = -1
        ccs_t = defaultdict(lambda: 0)
        i = 0
        for _,(t_nsec,cc_num) in ccs.iterrows():
            if not t_nsec == last_t_nsec:
                if last_t_nsec >= 0:
                    entry = [cc_count for _,cc_count in sorted(ccs_t.items())]
                    cc_counts_by_time[last_t_nsec] = entry
                    cc_counts_by_time_list.append((last_t_nsec/1000000000, len(entry)))

                last_t_nsec = t_nsec
                ccs_t = defaultdict(lambda: 0)

            ccs_t[cc_num] += 1

        entry = [cc_count for _,cc_count in sorted(ccs_t.items())]
        cc_counts_by_time[t_nsec] = entry
        cc_counts_by_time_list.append((t_nsec/1000000000, len(entry)))

        for (_,cc_count1),(t2,cc_count2) in zip(cc_counts_by_time_list[:-1], cc_counts_by_time_list[1:]):
            if not cc_count1 == cc_count2:
                cc_change_times.append([t2,cc_count2])

        return cc_counts_by_time,cc_change_times
