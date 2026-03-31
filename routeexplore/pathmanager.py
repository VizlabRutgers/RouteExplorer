import sys
from collections import defaultdict

import sqlite3
import pandas as pd

from routeexplore.routecategories import MajorRouteCategories,RouteCategories



class PathManager:
    def __init__(self, sqlitefile):
        self._sqlitefile = sqlitefile

        con = sqlite3.connect(sqlitefile)
        ts_df = pd.read_sql('select * from timestamps', con)

        tags_df = pd.read_sql('select * from tags', con)

        self._t_nsecs = sorted(ts_df.t_nsec.unique())

        self._tags = sorted(tags_df.tag.unique())

        self._categories = MajorRouteCategories


    def get_tags(self):
        return self._tags


    def get_categories(self):
        return self._categories


    def get_paths(self, tag, t_index):
        if t_index < 0:
            return []

        if t_index >= len(self._t_nsecs):
            return []

        t_nsec = self._t_nsecs[t_index]

        self._con = sqlite3.connect(self._sqlitefile)

        rows = self._con.execute(
            f'select * from routes2 where t_nsec=={t_nsec} and tag=="{tag}";')

        paths = defaultdict(lambda: {})

        src_dst_category_active = []

        for _,_,src_node,dst_node,active,route,category,hopcount,connected in rows.fetchall():
            path = tuple(map(int, route.split('-'))) if route else tuple()

            paths[src_node][dst_node] = path

            src_dst_category_active.append({
                'src':src_node,
                'dst':dst_node,
                'category': RouteCategories.toValue(category, hopcount),
                'active': active
            })

        return t_nsec,paths,src_dst_category_active


    def get_time_range(self):
        return (0, len(self._t_nsecs)-1)
