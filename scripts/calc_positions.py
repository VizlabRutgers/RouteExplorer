#!/usr/bin/env python3

from collections import defaultdict
import sys
import math
import pandas as pd
import sqlite3
import matplotlib.pyplot as plt


def get_position(n, t, pos):
    ts = sorted(pos.t, reverse=True)

    row = None
    n_rows = pos.shape[0]
    for i in range(n_rows, 0, -1):
        row = pos.iloc[i-1]
        if not row.node == n:
            continue
        if row.t <= t:
            break

    t_delta = t - row.t
    #print(t,n,row)
    return (row.x + row.vx * t_delta, row.y + row.vy * t_delta, row.z + row.vz * t_delta)


if not len(sys.argv) == 2:
    print('usage: calc_positions.py SQLITEFILE')
    exit(1)

sqlitefile = sys.argv[1]

con = sqlite3.connect(sqlitefile)
rx = pd.read_sql('select * from rx', con)
pos = pd.read_sql('select * from positions', con)
routes = pd.read_sql('select * from routes', con)

rx['t'] = rx.t_nsec / 1000000000
rx['delay_sec'] = rx.delay / 1000000000
pos['t'] = pos.t_nsec / 1000000000
routes['t'] = routes.t_nsec / 1000000000

rx_diff = rx.t.diff()
rx_diff_peak = rx[rx_diff > 5]
rejoin_idx = rx_diff_peak.index[0]

t_rejoin = rx.iloc[rejoin_idx].t
t_break = rx.iloc[rejoin_idx - 1].t

print(f't_break={t_break}')
print(f't_rejoin={t_rejoin}')

p_0_1 = defaultdict(lambda: [])

for i in range(1000):
    t = 100.0 + 0.1*i
    p_0_1[t].append(get_position(0, t, pos))
    p_0_1[t].append(get_position(1, t, pos))

dist = []

for t,(p0, p1) in sorted(p_0_1.items()):
    dist.append((t,
                 math.sqrt((p1[0]-p0[0])**2 + (p1[1]-p0[1])**2 + (p1[2]-p0[2])**2)))
    if abs(t-t_break)<=0.1:
        print(f'd_break={dist[-1][1]}')
    if abs(t-t_rejoin)<=0.1:
        print(f'd_rejoin={dist[-1][1]}')

fig = plt.figure()

ax = fig.add_subplot(1,1,1)

df = pd.DataFrame(dist, columns=['t', 'distance'])

df.plot(x='t', y='distance', marker='.', linestyle='none', ax=ax)

fig.savefig('distance.png')


