# routeexplorer/scripts

This directory contains scripts to execute ns-3 routing experimint
and convert it to a dataset in multiple steps. The resulting
dataset is contained in a single sqlite file and is served by
the routeexplorer web application.

The initial raw data are ns-3 simulator traces that are
processed into an sqlite file serverd by the routeexplorer REST API.

For this project the same scenario is executed running AODV, DSDV and
OLSR, the three unicast routing protocols included with ns-3.

The capture and translation of ns-3 trace information is accomplished
by these python scripts in the routeexplorer/scripts directory:

```
    1. rexp-run-manet-routing-compare
    2. rexp-parseroutes
    3. rexp-txt2sqlite
    4. rexp-annotate
    5. rexp-add-metrics
```


#### traces (rexp-run-manet-routing-compare)

ns-3 has been updated in a forked project to capture routing change
traces. These traces print a trace line for each change to a
forwarding table throughout the network. The trace logs are captured
separately for each protocol by running the `rexp-run-scenario`
script. The logs contain all of the raw information used for the
visualization including node position and transmit and receive packet
events.

The random waypoint model is selected for this scenario
whereby each node chooses a random destination and velocity and moves
from its current location to the new one. Upon reaching the
destination it immediately chooses the next. Between these times the
node position can be linearly interpolated between the starting and
next endpoints by the timestamp since the last log.

The `tx` event reports the destination IP address and the packet
sequence number and size. The context string also contains the node's
number "/NodeList/NodeNumber; ns-3 assigns node numbers from 0 to N to
the N+1 nodes in the scenario. The `rx` events lists the IP address of
the source of the packet it has received and the sequence number and
size. Each packet is part of a flow and each flow is assigned a
uniqued flow number. Flow traces are reported at the start of the logs
and include the source and destination node numbers and the flow start
and stop times.

The logs also contain a node trace at the beginning that lists the
IP address for each node interface.

The timestamps in the log have 7 decimal places - to the 10th
of a microsecond.

```
pos,100.9091013,/NodeList/43/$ns3::MobilityModel/CourseChange,201.7527455,1421.104507,0,0,0,0
pos,100.9091013,/NodeList/43/$ns3::MobilityModel/CourseChange,201.7527455,1421.104507,0,-0.07464752313,-1.899651952,0
route,100.914603,/NodeList/21/$ns3::aodv::RoutingProtocol/RouteAction,update,10.1.1.4,10.1.1.4,0,1,bidirectional
route,100.914603,/NodeList/21/$ns3::aodv::RoutingProtocol/RouteAction,update,10.1.1.20,10.1.1.20,0,1,bidirectional
rx,100.9170644,/NodeList/7/ApplicationList/0/$ns3::PacketSink/RxWithSeqTsSize,10.1.1.18,0,64
tx,100.9402405,/NodeList/14/ApplicationList/0/$ns3::OnOffApplication/TxWithSeqTsSize,10.1.1.5,0,64
```

The logs are captured to the traces directory.

```
	$ tree manet-routing-compare/
	manet-routing-compare/
	├── 100
	│   ├── rexp-raw.sqlite
	│   ├── rexp-tidy.sqlite
	│   └── mrc100.sqlite
	├── tables
	│   ├── aodv-flows.txt
	│   ├── aodv-forwardingtables.txt
	│   ├── aodv-nodetoip.txt
	│   ├── aodv-positions.txt
	│   ├── aodv-routes.txt
	│   ├── aodv-rx.txt
	│   ├── aodv-tx.txt
	│   ├── dsdv-flows.txt
	│   ├── dsdv-forwardingtables.txt
	│   ├── dsdv-nodetoip.txt
	│   ├── dsdv-positions.txt
	│   ├── dsdv-routes.txt
	│   ├── dsdv-rx.txt
	│   ├── dsdv-tx.txt
	│   ├── olsr-active-loop.txt
	│   ├── olsr-flows.txt
	│   ├── olsr-forwardingtables.txt
	│   ├── olsr-nodetoip.txt
	│   ├── olsr-positions.txt
	│   ├── olsr-routes.txt
	│   ├── olsr-rx.txt
	│   └── olsr-tx.txt
	└── traces
	    ├── routing-manet-routing-compare-aodv.log
	    ├── routing-manet-routing-compare-dsdv.log
	    └── routing-manet-routing-compare-olsr.log

	3 directories, 28 files
```


##### tables (rexp-parseroutes)

`rexp-parseroutes` ingests the three trace files to generate separate text
files that break out each of the pieces of information into individual
text files - see the `tables` directory above. The file names are prefixed
with the associated routing protocol.

The flows, positions, tx and rx files are basically straight translations
of their log traces accept that IP addresses are translated to node numbers
[1,N], timestamps are converted from real to nanosecond integers though
note that the last two digits are always 0 so the precision of the input
logs (7 decimal places) is preserved. For rx the packet latency time is
computed from the real number timestamps in the traces and converted
to nanoseconds.

* flows.txt
* forwardingtables.txt
* nodetoip.txt
* positions.txt
* routes.txt
* rx.txt
* tx.txt

For routes quite a bit more is done. From the trace file the forwarding
tables are computed and printed to the forwardingtables.txt file - each
entry has the complete node forwarding table. The timestamp and node number
are followed by forwarding entries of destination node, next hop node and
hop count to the destination.

In a second pass the routes.txt file is created by iterating over the
forwarding tables and starting from each node's entry attempting
to calculate the full path to the entry destination with the reporting
node as the source. For each source,destination node pair the corresponding
routes.txt entry will include the longest sequence of nodes that could
be determined from the forwarding tables and a label of either valid, loop
or incomplete. valid when the entire path could be determined from source
to destination, loop where the path returns to a previous hop along the
path before reaching the destination and incomplete where a forwarding
table along the way fails to have a next hop for the destination.

Route entries are only printed at the timestep passed at the command
line with the default being every 0.1 seconds (100000000 nanoseconds).


##### mrc100.sqlite (rexp-txt2sqlite)

This script aggregates the tables created in the last step into
a single sqlite file. The output files has these tables:

    * flows
    * positions
    * routes
    * rx
    * tx



##### mvraw.sqlite (rexp-annotate)

`rexp-annotate` converts the output of `rexp-txt2sqlite` into an sqlite
file. It creates

    * params - adds link_distance from command line arg
    * timepoints
    * tx
    * rx
    * flows
    * positions - calculated from waypoint logs interpolating
                  positions from time.
    * neighbors - calculated
    * routes - copy input table to output but marking
               "broken" routes now based on neighbor informaion

The --dlinkbreak argument allows this file to determine a
*broken* link from the data based on current positions and
the threshold value passed in by the user. The value is
saved to the "params" table.

An additional input to this process, for this particular data set where
all nodes use the same transmit power and an omnidirectional antenna is
a distance number considered to be the threshold distance for connected
and disconnected links. This allows labeling routes as "broken" if a
forwarding decision attempts to traverse a graph edge that is out of range.
This number has to be determined from experimentation or calculation and
is fuzzy since communication links are partly functional at distances
between 100% connectivity and 0%. A hysteresis value may even be more
appropriate - 2 different numbers that determine when to change the link
state depending on whether the link is forming or breaking.

This link calculation obviously derives from knowledge of node position
at each recalculation for routes. And this raises the decision immediately
of the timescale at which to calculate the network state. Seen from the log
above, the trace timestamps have a 1 microsecond posiition. So at the densest
we could regenerate node position and route state for every unique timestamp.
Even this generates large sqlite databases which are not that practical to
store, at least in version control. So a good decision to make at this
juncture of coverting logs to raw position and route state is the time
step. `manet-routing-compare-100` means the data pipeline in
this director chose 100 micro-seconds as the timestep. The output
of this pipeline step is the mrc100.sqlite file. The file contains calculate
routes for each of the three routing protocols consolidated into a single
"routes" table at 100 micro-second boundaries. It also calculates node
positions at each timepoint and this is independent of routing protocol
since the same scenario was used for all three.


##### mvtidy.sqlite (rexp-add-metrics)



