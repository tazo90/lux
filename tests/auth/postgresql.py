from . import sqlite


class TestPostgreSql(sqlite.TestSqlite):
    config_params = {
        'DATASTORE': 'postgresql+green://lux:luxtest@127.0.0.1:5432/luxtests'
    }
