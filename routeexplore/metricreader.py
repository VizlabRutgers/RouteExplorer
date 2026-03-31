from collections import defaultdict

import pandas as pd
import sqlite3


class MetricReader:
    def __init__(self, sqlitefile):
        self._metric_records = []
        self._metric_totals = []
        self._metric_totals_by_node = []

        self._sqlitefile = sqlitefile

        con = sqlite3.connect(sqlitefile)

        # flatten rm_df to a list of dictionaries with format
        # {
        #     t: t_nsec,
        #     tag: tag,
        #     active: active,
        #     connected: connected,
        #     noroute: count
        #     broken: count,
        #     incomplete: count,
        #     loop: count,
        #     valid: count
        # }
        #
        # and (totalled of active and connected groupins)
        #
        # {
        #     t: t_nsec,
        #     tag: tag,
        #     noroute: count
        #     broken: count,
        #     incomplete: count,
        #     loop: count,
        #     valid: count
        # }
        #
        # and by src_node
        #
        # {
        #     t: t_nsec,
        #     tag: tag,
        #     src_node: src_node,
        #     noroute: count
        #     broken: count,
        #     incomplete: count,
        #     loop: count,
        #     valid: count
        # }

        # these records can be filtered and processed on front end side
        # for graphing

        df = pd.read_sql('select * from route_metrics', con)
        for _,tpl in df.iterrows():
            record = {
                't': tpl.t_nsec/1000000000,
                'tag': tpl.tag,
                'active': tpl.active,
                'connected': tpl.connected,
                'noroute': tpl.noroute,
                'broken': tpl.broken,
                'incomplete': tpl.incomplete,
                'loop': tpl.loop,
                'valid1': tpl.valid1,
                'valid2': tpl.valid2,
                'valid3': tpl.valid3,
                'valid4': tpl.valid4,
                'valid5': tpl.valid5,
                'valid6': tpl.valid6,
                'valid7': tpl.valid7,
                'valid8': tpl.valid8,
                'valid9': tpl.valid9,
                'valid10': tpl.valid10
            }
            self._metric_records.append(record)

        df = pd.read_sql('select * from route_metric_totals', con)
        for _,tpl in df.iterrows():
            record = {
                't': tpl.t_nsec/1000000000,
                'tag': tpl.tag,
                'noroute': tpl.noroute,
                'broken': tpl.broken,
                'incomplete': tpl.incomplete,
                'loop': tpl.loop,
                'valid1': tpl.valid1,
                'valid2': tpl.valid2,
                'valid3': tpl.valid3,
                'valid4': tpl.valid4,
                'valid5': tpl.valid5,
                'valid6': tpl.valid6,
                'valid7': tpl.valid7,
                'valid8': tpl.valid8,
                'valid9': tpl.valid9,
                'valid10': tpl.valid10
            }
            self._metric_totals.append(record)

        df = pd.read_sql('select * from route_metrics_by_node', con)
        for _,tpl in df.iterrows():
            record = {
                't': tpl.t_nsec/1000000000,
                'tag': tpl.tag,
                'src_node': tpl.src_node,
                'noroute': tpl.noroute,
                'broken': tpl.broken,
                'incomplete': tpl.incomplete,
                'loop': tpl.loop,
                'valid1': tpl.valid1,
                'valid2': tpl.valid2,
                'valid3': tpl.valid3,
                'valid4': tpl.valid4,
                'valid5': tpl.valid5,
                'valid6': tpl.valid6,
                'valid7': tpl.valid7,
                'valid8': tpl.valid8,
                'valid9': tpl.valid9,
                'valid10': tpl.valid10
            }
            self._metric_totals_by_node.append(record)

        self._rx_packets_bounds,self._rx_packets = self._process_receptions(con)


    @property
    def metrics(self):
        return self._metric_records


    @property
    def metric_totals(self):
        return self._metric_totals

    @property
    def metric_totals_by_node(self):
        return self._metric_totals_by_node

    @property
    def rx_packets(self):
        return self._rx_packets

    @property
    def rx_packets_bounds(self):
        return self._rx_packets_bounds

    def _process_receptions(self, con):
        rx_df = pd.read_sql('select * from rx', con)

        rx_df["t"] = rx_df.t_nsec.apply(lambda x: round(x/1000000000, 1))

        rx_counts = rx_df.groupby(['t','tag'])['size'].count()

        rx_bounds = {'rx_min_packets':0, 'rx_max_packets': rx_counts.max()}
        reception_records = []
        for t_prot,count in rx_counts.to_frame().itertuples():
            t,prot = t_prot
            reception_records.append({"t":t, "tag":prot, "count":count})

        return rx_bounds,reception_records
