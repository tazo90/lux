/**
 * Created by Reupen on 02/06/2015.
 */

angular.module('lux.form.utils', ['lux.services'])
    //
    .factory('remoteService', ['$lux', '$q', '$timeout', function($lux, $q, $timeout) {
        var remoteService = {

            /*
             * Value from not first pagination page, that need to be excluded to get rid duplicate items
            */
            excludeValue: '',

            /**
             * Called to get remote options from the API
             *
             * @param api
             * @param target
             * @param scope
             * @param attrs
             * @param config {object} - parameters passed to query string in request
             * @param searchValue {string} - value of the search was were typed in input field
             * @param extendCurrentOptions {boolean} - flag that indicates whether to add new options to existing options
             * @returns {promise}
             */
            query: function(api, target, scope, attrs, select, config, searchValue, extendCurrentOptions) {
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

                    remoteService.parseOptions(data.data.result, options, attrs, config, extendCurrentOptions);

                    // If initially value comes from not the first pagination page,
                    // then we need to get element from API because of the field repr.
                    require(['lodash'], function(_) {
                        var selectedValue = scope[scope.formModelName][attrs.name];
                        if (selectedValue.length > 0 && searchValue === null) {
                            var isElementFromFirstPage = _.findIndex(options, function(item) {
                                return item.id === selectedValue;
                            });
                            // If selected value doenn't exist in current options then get it
                            // and add to the options
                            if (isElementFromFirstPage === -1) {
                                remoteService.excludeValue = selectedValue;

                                config.params[config.id] = selectedValue;
                                api.get(null, config.params).then(function(data) {
                                    remoteService.parseOptions(data.data.result, options, attrs, config, extendCurrentOptions);
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
            parseOptions: function(raw_options, options, attrs, config, extendCurrentOptions) {
                angular.forEach(raw_options, function (option) {
                    var repr,
                        optionId;

                    if (config.nameFromFormat) {
                        repr = formatString(config.nameOpts.source, option);
                    } else {
                        repr = option[config.nameOpts.source];
                    }

                    if (attrs.multiple) {
                        // For multiple field always get id of the object
                        optionId = option.id;
                    } else {
                        optionId = option[config.id];
                    }

                    if (extendCurrentOptions) {
                        if (remoteService.excludeValue !== optionId) {
                            options.push({
                                id: optionId,
                                repr: repr
                            });
                        }
                    } else {
                        options.push({
                            id: optionId,
                            repr: repr
                        });
                    }
                });
            }
        };

        return remoteService;
    }])
    //
    .directive('selectInfinity', ['$parse', '$timeout', function($parse, $timeout) {
        function height(elem) {
            elem = elem[0] || elem;
            if (isNaN(elem.offsetHeight)) {
                return elem.document.documentElement.clientHeight;
            } else {
                return elem.offsetHeight;
            }
        }

        function offsetTop(elem) {
            if (!elem[0].getBoundingClientRect || elem.css('none')) {
                return;
            }
            return elem[0].getBoundingClientRect().top + pageYOffset(elem);
        }

        function pageYOffset(elem) {
            elem = elem[0] || elem;
            if (isNaN(window.pageYOffset)) {
                return elem.document.documentElement.scrollTop;
            } else {
                return elem.ownerDocument.defaultView.pageYOffset;
            }
        }

        /**
         * Since scroll events can fire at a high rate, the event handler
         * shouldn't execute computationally expensive operations such as DOM modifications.
         * based on https://developer.mozilla.org/en-US/docs/Web/Events/scroll#requestAnimationFrame_.2B_customEvent
         *
         * @param type
         * @param name
         * @param (obj)
         * @returns {Function}
         */
        function throttle(type, name, obj) {
            var running = false;

            obj = obj || window;

            var func = function() {
                if (running) {
                    return;
                }

                running = true;
                requestAnimationFrame(function() {
                    obj.dispatchEvent(new CustomEvent(name));
                    running = false;
                });
            };

            obj.addEventListener(type, func);

            return function() {
                obj.removeEventListener(type, func);
            };
        }

        return {
            link: function(scope, elem, attrs) {
                var container = elem,
                    scrollDistance = 0,
                    removeThrottle;

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

                    removeThrottle = throttle('scroll', 'optimizedScroll', container[0]);
                    container.on('optimizedScroll', handler);

                    scope.$on('$destroy', function() {
                        removeThrottle();
                        container.off('optimizedScroll', handler);
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
    //
    .directive('remoteOptions', ['$lux', '$timeout', '$q', 'remoteService', function ($lux, $timeout, $q, remoteService) {

        /*
         * Set up initial values used in query strings
         * @param config {object} query strings and settings
         */
        function setupInitialQuery(config) {
            config.params.limit = config.queryInitial.limit;
            config.params.offset = config.queryInitial.offset;
            delete config.params[config.id];
        }

        function fill(api, target, scope, attrs, select) {

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
            };

            config.nameFromFormat = config.nameOpts.type === 'formatString';

            setupInitialQuery(config);

            // Set empty value if field was not filled
            if (scope[scope.formModelName][attrs.name] === undefined) {
                scope[scope.formModelName][attrs.name] = '';
            }

            remoteService.query(api, target, scope, attrs, select, config, null, false);

             // Custom filter function
            scope.remoteSearch = function($select, isMultipleField) {
                if ($select.search !== '') {
                    var searchValue = $select.search;
                    setupInitialQuery(config);

                    // For multiple fields use name as a lookup key
                    if (isMultipleField === true)
                        config.id = 'name';

                    remoteService.query(api, target, scope, attrs, select, config, searchValue, false);
                } else {
                    // Reset options
                    scope.getInitialOptions();
                }
            };

            scope.getInitialOptions = function() {
                // Set initial params
                setupInitialQuery(config);
                // Reset info about chunk
                scope.hasNextChunk = true;
                // Get data
                remoteService.query(api, target, scope, attrs, select, config, null, false);
            };

            // Handles selection on multiple select
            scope.multipleSelect = function($select, value) {
                var selected = scope[scope.formModelName][attrs.name];
                // If selected 'Please select...' then remove it
                if (value === '') {
                    selected.pop();
                    $select.selected.pop();
                }
            };

            function getInfinityScrollChunk(config) {
                return remoteService.query(api, target, scope, attrs, select, config, null, true);
            }

            // Handler for infinity scroll
            scope.loadMore = function() {
                if (scope.isRequestMoreItems || !scope.hasNextChunk)
                    return $q.reject();

                scope.isRequestMoreItems = true;
                config.params.offset += config.params.limit;
                return getInfinityScrollChunk(config)
                    .then(function(data) {
                        var options = scope[target.name];
                        if (options.length > config.optionsTotal)
                            scope.hasNextChunk = false;
                    }, function(err) {
                        return $q.reject(err);
                    })
                    .finally(function() {
                        scope.isRequestMoreItems = false;
                    });
                };
        }

        function link(scope, element, attrs) {
            var select = element.scope().$select;

            if (attrs.remoteOptions) {
                var target = JSON.parse(attrs.remoteOptions),
                    api = $lux.api(target);

                if (api && target.name)
                    return fill(api, target, scope, attrs, select);
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
