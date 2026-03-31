#!/usr/bin/env python3

import random


myGroups = range(50)
myVars = range(50)

with open('data.py', 'w') as fd:
    fd.write('matrix=[\n')

    for g in myGroups:
        for v in myVars:
            fd.write('    {"src":%d, "dst":%d, "value":%d},\n' % (g, v, random.randint(1,100)))

    fd.write(']\n')
