#!/bin/bash

if [ ! $# -eq 2 ]; then
    echo "rexp-workflow.sh DATAROOT OUTROOT"
    exit 1
fi

dataroot=$1
outroot=$2
tablesdir=$outroot/tables
rawsqlite=$outroot/rexp-raw.sqlite
tidysqlite=$outroot/rexp-tidy.sqlite

echo "### rexp-parse-logs $dataroot $outroot/tables"
rexp-parse-logs $dataroot $outroot/tables

echo "### rexp-txt2sqlite $tablesdir $rawsqlite"
rexp-txt2sqlite $tablesdir $rawsqlite

echo "### rexp-annotate $rawsqlite $tidysqlite"
rexp-annotate $rawsqlite $tidysqlite

echo "### rexp-add-metrics $tidysqlite"
rexp-add-metrics $tidysqlite
