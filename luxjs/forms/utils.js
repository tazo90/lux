/**
 * Created by Reupen on 02/06/2015.
 */

angular.module('lux.form.utils', ['lux.services'])
    //
    .factory('remoteService', ['$lux', '$q', '$timeout', function($lux, $q, $timeout) {
        var remoteService = {

            /*
             * Value from not first pagination page, that need to be excluded to get rid duplicate items.
            */
            excludeValue: '',

            /**
             * Called to get remote options from the API.
             *
             * @param api
             * @param target
             * @param scope
             * @param attrs
             * @param config {object} - parameters passed to query string in request
             * @param searchValue {string} - value of the search was were typed in input field
             * @param extendCurrentOptions {boolean} - flag that indicates if add new options to existing options
             * @returns {promise}
             */
            query: function(api, target, scope, attrs, config, searchValue, extendCurrentOptions) {
                var defer = $q.defer(),
                    options = scope[target.name];

                if (searchValue === null)
                    delete config.params[config.id];
                else
                    config.params[config.id] = searchValue;

                if (!extendCurrentOptions) {
                    // Add initial options
                    options = [];
                    scope[target.name] = options;
                    config.initialValue.id = '';
                    config.initialValue.repr = 'Loading...';
                    options.push(config.initialValue);
                }

                api.get(null, config.params).then(function(data) {
                    // Get amount of total items
                    config.optionsTotal = data.data.total;

                    if (searchValue !== null && data.data.result.length === 0) {
                        options[0].repr = 'No matches found';
                    } else {
                        options[0].repr = 'Please select...';
                    }

                    remoteService.getOptions(data.data.result, options, attrs, config, extendCurrentOptions);

                    // If initially value comes from not the first pagination page,
                    // then we need to get element from API because of the field repr.
                    require(['lodash'], function(_) {
                        var selectedValue = scope[scope.formModelName][attrs.name];
                        if (!attrs.multiple && searchValue === null) {
                            var isElementFromFirstPage = _.findIndex(options, function(item) {
                                return item.id === selectedValue;
                            });

                            if (isElementFromFirstPage === -1) {
                                remoteService.excludeValue = selectedValue;

                                config.params[config.id] = selectedValue;
                                api.get(null, config.params).then(function(data) {
                                    if (data.data.result.length > 0) {
                                        var option = remoteService.parseOption(data.data.result[0], attrs, config);
                                        // Add an option to the third place from the end
                                        options.splice(options.length-3, 0, option);
                                        // Update selected value in list
                                        scope.$select.selected = option;
                                    }
                                });
                            }
                        }
                    });

                    defer.resolve(data);

                }, function(data) {
                    options[0] = '(error loading options)';
                    defer.reject();
                });
                return defer.promise;
            },

            /**
             * Parses single option to the correct format.
             *
             * @param option {object} - id and repr attributes
             * @param attrs {object}
             * @param config {object} - parameters passed to query string in request
             * @returns {object}
             */
            parseOption: function(option, attrs, config) {
                var parsedOption = {
                    id: option[config.id],
                    repr: option[config.nameOpts.source]
                };

                if (config.nameFromFormat) {
                    parsedOption.repr = formatString(config.nameOpts.source, option);
                }

                if (attrs.multiple) {
                    // For multiple field always get id of the object
                    parsedOption.id = option.id;
                }

                return parsedOption;
            },

            /**
             * Returns all parsed options.
             *
             * @param raw_options {object} - options fetched from the API
             * @param options {object} - current `options` from select
             * @param attrs {object}
             * @param config {object} - parameters passed to query string in request
             * @param extendCurrentOptions {boolean} - indicates whether to extend current `options` using `raw_options` from the API
             */
            getOptions: function(raw_options, options, attrs, config, extendCurrentOptions) {
                angular.forEach(raw_options, function (option) {
                    var parsedOption = remoteService.parseOption(option, attrs, config);

                    if (extendCurrentOptions) {
                        if (remoteService.excludeValue !== parsedOption.id) {
                            options.push(parsedOption);
                        }
                    } else {
                        options.push(parsedOption);
                    }
                });
            }
        };

        return remoteService;
    }])
    /**
     * Extension of ui-select to support infinite list of items.
     */
    .directive('selectInfinity', ['$parse', '$timeout', function($parse, $timeout) {
        /**
         * Returns the height of the given element
         *
         * @param elem
         * @returns {integer} - height of the element
         */
        function height(elem) {
            elem = elem[0] || elem;
            if (isNaN(elem.offsetHeight)) {
                return elem.document.documentElement.clientHeight;
            } else {
                return elem.offsetHeight;
            }
        }

        /**
         * Returns the distance from the top of the closest relatively positioned parent element.
         *
         * @param elem
         * @returns {integer}
         */
        function offsetTop(elem) {
            if (!elem[0].getBoundingClientRect || elem.css('none')) {
                return;
            }
            return elem[0].getBoundingClientRect().top + pageYOffset(elem);
        }

        /**
         * Returns the distance, in pixels, that a document has scrolled vertically.
         *
         * @param elem
         * @returns {integer}
         */
        function pageYOffset(elem) {
            elem = elem[0] || elem;
            if (isNaN(window.pageYOffset)) {
                return elem.document.documentElement.scrollTop;
            } else {
                return elem.ownerDocument.defaultView.pageYOffset;
            }
        }

        return {
            link: function(scope, elem, attrs) {
                var container = elem,
                    scrollDistance = 0,
                    removeThrottle;

                /**
                 * Sets infinite scroll on `.ui-select-choices` element.
                 */
                function tryToSetupInfinityScroll() {
                    var rows = elem.querySelectorAll('.ui-select-choices-row');

                    if (rows.length === 0) {
                        return false;
                    }

                    var lastChoice = angular.element(rows[rows.length - 1]);
                    container = angular.element(elem.querySelectorAll('.ui-select-choices'));

                    var handler = function() {
                        var containerBottom = height(container),
                            containerTopOffset = 0,
                            elementBottom;

                        if (offsetTop(container) !== void 0) {
                            containerTopOffset = offsetTop(container);
                        }

                        elementBottom = offsetTop(lastChoice) - containerTopOffset + height(lastChoice);
                        var remaining = elementBottom - containerBottom,
                            shouldScroll = remaining <= height(container) * scrollDistance + 1;

                        if (shouldScroll) {
                            scope.$apply(function() {
                                $parse(attrs.selectInfinity)(scope);
                            });
                        }
                    };

                    // Sets debounce function for scroll handler
                    require(['lodash'], function(_) {
                        // Executes 500ms after last call of the debounced function.
                        var debounced = _.debounce(handler, 500);
                        container.on('scroll', debounced);

                        scope.$on('$destroy', function() {
                            debounced();
                        });
                    });

                    return true;
                }

                var unbindWatcher = scope.$watch('$select.open', function(newItems) {
                    if (!newItems) {
                        return;
                    }

                    $timeout(function() {
                        if (tryToSetupInfinityScroll()) {
                            unbindWatcher();
                        }
                    });
                });
            }
        };
    }])
    /**
     * Extension of select to get options from an external API.
     */
    .directive('remoteOptions', ['$lux', '$q', 'remoteService', function ($lux, $q, remoteService) {

        /*
         * Set up initial values used in query strings
         * @param config {object} query strings and settings
         */
        function setupInitialQuery(config) {
            config.params.limit = config.queryInitial.limit;
            config.params.offset = config.queryInitial.offset;
            delete config.params[config.id];
        }

        /*
         * Initializes remoteOptions directive.
         *
         * @param api {object} - instance of an external API
         * @param target {object}
         * @param scope
         * @param attrs
         */
        function fill(api, target, scope, attrs) {

            var config = {
                id: attrs.remoteOptionsId || 'id',
                nameOpts: attrs.remoteOptionsValue ? JSON.parse(attrs.remoteOptionsValue) : {
                    type: 'field',
                    source: 'id'
                },
                initialValue: {},
                params: JSON.parse(attrs.remoteOptionsParams || '{}'),
                optionsTotal: 0,
                queryInitial: {
                    limit: 25,
                    offset: 0
                }
            },
            loadingItem = {
                id: '',
                repr: 'Loading...'
            };

            config.nameFromFormat = config.nameOpts.type === 'formatString';

            setupInitialQuery(config);

            // Set empty value if field was not filled
            if (scope[scope.formModelName][attrs.name] === undefined) {
                scope[scope.formModelName][attrs.name] = '';
            }

            remoteService.query(api, target, scope, attrs, config, null, false);

            /**
             * Enables search from an external API.
             *
             * @param $select {object} - instance of ui-select
             * @param isMultipleField {boolean} - indicates if it is multiple field
             */
            scope.remoteSearch = function($select, isMultipleField) {
                if ($select.search !== '') {
                    var searchValue = $select.search;
                    setupInitialQuery(config);

                    // For multiple fields use name as a lookup key
                    if (isMultipleField === true)
                        config.id = 'name';

                    remoteService.query(api, target, scope, attrs, config, searchValue, false);
                } else {
                    // Reset options
                    scope.getInitialOptions();
                }
            };

            /**
             * Sets parameters and gets options (first of the pagination page).
             */
            scope.getInitialOptions = function() {
                // Set initial params
                setupInitialQuery(config);
                // Reset info about chunk
                scope.hasNextChunk = true;
                // Get data
                remoteService.query(api, target, scope, attrs, config, null, false);
            };

            /**
             * Handles selection on multiple select.
             *
             * @param $select {object} - instance of ui-select
             * @param value {object} - value of the multiple field
             */
            scope.multipleSelect = function($select, value) {
                var selected = scope[scope.formModelName][attrs.name];
                // If selected 'Please select...' then remove it
                if (value === '') {
                    selected.pop();
                    $select.selected.pop();
                }
            };

            /**
             * Wraps query method of the removeService.
             *
             * @param config
             * @returns {promise} - result of the query method
             */
            function getInfinityScrollChunk(config) {
                return remoteService.query(api, target, scope, attrs, config, null, true);
            }

            /**
             * Adds loading item, it is triggered when we are starting downloading the options.
             */
            function addLoadingStateItem() {
                var options = scope[target.name],
                    lastIndex = options.length - 1;
                options.splice(lastIndex, 0, loadingItem);
            }

            /**
             * Removes loading item, it is triggered when finish retrieve elements
             * from the specific pagination page.
             */
            function removeLoadingStateItem() {
                var options = scope[target.name],
                    index = options.indexOf(loadingItem);
                if (index < 0) {
                    return;
                }
                options.splice(index, 1);
            }

            /**
             * Handler for infinity scroll.
             */
            scope.loadMore = function() {
                if (scope.isRequestMoreItems || !scope.hasNextChunk)
                    return $q.reject();

                // Add loading indicator
                addLoadingStateItem();

                scope.isRequestMoreItems = true;
                // Update offset value which is passed in query string of the request
                config.params.offset += config.params.limit;
                //
                return getInfinityScrollChunk(config)
                    .then(function(data) {
                        var options = scope[target.name];
                        // Check if we can load more options
                        if (options.length > config.optionsTotal)
                            scope.hasNextChunk = false;
                    }, function(err) {
                        return $q.reject(err);
                    })
                    .finally(function() {
                        // Remove loading indicator
                        removeLoadingStateItem();
                        scope.isRequestMoreItems = false;
                    });
                };
        }

        function link(scope, element, attrs) {
            if (attrs.remoteOptions) {
                var target = JSON.parse(attrs.remoteOptions),
                    api = $lux.api(target);

                if (api && target.name)
                    return fill(api, target, scope, attrs);
            }
            // TODO: message
        }

        return {
            link: link
        };
    }])
    //
    .directive('selectOnClick', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element.on('click', function () {
                    if (!window.getSelection().toString()) {
                        // Required for mobile Safari
                        this.setSelectionRange(0, this.value.length);
                    }
                });
            }
        };
    });
