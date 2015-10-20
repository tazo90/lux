/**
 * Created by Reupen on 02/06/2015.
 */

angular.module('lux.form.utils', ['lux.services'])
    //
    .directive('reachInfinity', ['$parse', '$timeout', function($parse, $timeout) {
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
                                $parse(attrs.reachInfinity)(scope);
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
    .factory('remoteService', ['$lux', '$q', function($lux, $q) {
        return {
            query: function(api, target, scope, attrs, config, searchValue, extendCurrentOptions) {

                var defer = $lux.q.defer();

                if (extendCurrentOptions) {
                    // Add more items to current options
                    options = scope[target.name];

                    if (options.length > config.optionsTotal) {
                        defer.reject();
                        return defer.promise;
                    } else {
                        // Increase offset
                        config.params.offset += config.params.limit;
                    }
                } else {
                    var options = [];
                    scope[target.name] = options;

                    config.initialValue.id = '';
                    config.initialValue.name = 'Loading...';

                    options.push(config.initialValue);
                }

                if (searchValue === undefined)
                    delete config.params[config.id];
                else
                    config.params[config.id] = searchValue;

                api.get(null, config.params).then(function(data) {
                    // Get amount of total items
                    config.optionsTotal = data.data.total;

                    //if (searchValue !== undefined && data.data.result.length === 0)
                        //options[0].name = 'Cannot find value';
                    //else
                        options[0].name = 'Please select...';

                    angular.forEach(data.data.result, function (val) {
                        var name;
                        if (config.nameFromFormat) {
                            name = formatString(config.nameOpts.source, val);
                        } else {
                            name = val[config.nameOpts.source];
                        }

                        var optionId;
                        if (attrs.multiple)
                            // For multiple field always get id of the object
                            optionId = val.id;
                        else
                            optionId = val[config.id];

                        options.push({
                            id: optionId,
                            name: name
                        });
                    });

                    defer.resolve(options);

                }, function(data) {
                    options[0] = '(error loading options)';
                    defer.reject();
                });
                return defer.promise;
            },
            //
            setupQueryInitial: function(config) {
                config.params.limit = config.queryInitial.limit;
                config.params.offset = config.queryInitial.offset;
                delete config.params[config.id];
            }
        };
    }])
    //
    .directive('remoteOptions', ['$lux', '$q', 'remoteService', function ($lux, $q, remoteService) {

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
            };

            remoteService.setupQueryInitial(config);

            config.nameFromFormat = config.nameOpts.type === 'formatString';

            // Set empty value if field was not filled
            if (scope[scope.formModelName][attrs.name] === undefined)
                scope[scope.formModelName][attrs.name] = '';

            remoteService.query(api, target, scope, attrs, config, null, false);

             // Custom filter function
            scope.remoteSearch = function($select, fieldMultiple) {
                if ($select.search !== '') {
                    var searchValue = $select.search;

                    remoteService.setupQueryInitial(config);

                    // For multiple fields use name as a lookup key
                    if (fieldMultiple === true)
                        config.id = 'name';

                    remoteService.query(api, target, scope, attrs, config, searchValue, false);
                } else {
                    // Get initial options
                    scope.resetOptions();
                }
            };

            // Get initial data
            scope.resetOptions = function() {
                remoteService.setupQueryInitial(config);
                remoteService.query(api, target, scope, attrs, config, null, false);
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

            // Handler for infinity scroll
            scope.loadMore = function() {
                remoteService.query(api, target, scope, attrs, config, null, true);
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
