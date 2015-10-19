/**
 * Created by Reupen on 02/06/2015.
 */

angular.module('lux.form.utils', ['lux.services'])
    //
    .constant('remoteOptionsDefaults', {
        // request delay in ms
        requestDelay: 500,
    })
    //
    .directive('remoteOptions', ['$lux', 'remoteOptionsDefaults', function ($lux, remoteOptionsDefaults) {

        function getData(api, target, scope, attrs, config, type) {
            var options = [];
            scope[target.name] = options;

            config.initialValue.id = '';
            config.initialValue.name = 'Loading...';

            options.push(config.initialValue);

            api.get(null, config.params).then(function(data) {
                if (attrs.multiple) {
                    options.splice(0, 1);
                } else {
                    options[0].name = 'Please select...';
                }

                if (type === 'search' && data.data.result.length === 0)
                    options[0].name = 'Cannot find value';

                angular.forEach(data.data.result, function (val) {
                    var name;
                    if (config.nameFromFormat) {
                        name = formatString(config.nameOpts.source, val);
                    } else {
                        name = val[config.nameOpts.source];
                    }

                    options.push({
                        id: val[config.id],
                        name: name
                    });
                });
            }, function(data) {
                options[0] = '(error loading options)';
            });
        }


        function fill(api, target, scope, attrs) {
            var config = {
                id: attrs.remoteOptionsId || 'id',
                nameOpts: attrs.remoteOptionsValue ? JSON.parse(attrs.remoteOptionsValue) : {
                    type: 'field',
                    source: 'id'
                },
                initialValue: {},
                params: JSON.parse(attrs.remoteOptionsParams || '{}')
            };

            config.nameFromFormat = config.nameOpts.type === 'formatString';

            // Set empty value if field was not filled
            if (scope[scope.formModelName][attrs.name] === undefined)
                scope[scope.formModelName][attrs.name] = '';

            getData(api, target, scope, attrs, config, 'initial');


            // Custom filter function
            scope.remoteSearch = function($select) {
                if ($select.search !== '') {
                    config.params[config.id] = $select.search;
                    getData(api, target, scope, attrs, config, 'search');
                } else {
                    // Get initial options
                    scope.resetOptions();
                }
            };

            scope.resetOptions = function() {
                delete config.params[config.id];
                getData(api, target, scope, attrs, config, 'initial');
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
