## API
* RestModel
    * The ``:search`` operator now explicitly provides a full-text search config/language to PostgreSQL, allowing such queries to use available GIN/GiST indexes. This defaults to `english`, and can be overridden globally via the `DEFAULT_TEXT_SEARCH_CONFIG` parameter or per-column by passing `info={'text_search_config'='language'}` to `sqlalchemy.Column.__init__`.

## Javascript
* Update angular-ui-select to version 0.13.2
* Added support to ui-select to pull all data from an API (lazily loading) [[#158](https://github.com/quantmind/lux/issues/158)]
