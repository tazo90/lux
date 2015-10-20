/**
 * Created by Reupen on 02/06/2015.
 */

angular.module('lux.form.utils', ['lux.services'])
    //
    .directive('remoteOptions', ['$lux', function ($lux) {

        function getData(api, target, scope, attrs, config, searchValue) {
            var options = [];
            scope[target.name] = options;

            config.initialValue.id = '';
            config.initialValue.name = 'Loading...';

            options.push(config.initialValue);

            if (searchValue === undefined)
                delete config.params[config.id];
            else
                config.params[config.id] = searchValue;

            api.get(null, config.params).then(function(data) {
                /*if (attrs.multiple) {
                    options.splice(0, 1);
                } else {
                    if (searchValue !== undefined && data.data.result.length === 0)
                        options[0].name = 'Cannot find value';
                    else
                        options[0].name = 'Please select...';
                }*/

                if (searchValue !== undefined && data.data.result.length === 0)
                    options[0].name = 'Cannot find value';
                else
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
                        // For multiple field get always id of the object
                        optionId = val.id;
                    else
                        optionId = val[config.id];

                    options.push({
                        id: optionId,
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

            getData(api, target, scope, attrs, config, null);

             // Custom filter function
            scope.remoteSearch = function($select, fieldMultiple) {
                if ($select.search !== '') {
                    var searchValue = $select.search;

                    // For multiple fields use name as a lookup key
                    if (fieldMultiple === true)
                        config.id = 'name';

                    getData(api, target, scope, attrs, config, searchValue);
                } else {
                    // Get initial options
                    scope.resetOptions();
                }
            };

            // Get initial data
            scope.resetOptions = function() {
                getData(api, target, scope, attrs, config, null);
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
