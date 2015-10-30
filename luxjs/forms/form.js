    //
    // Form module for lux
    //
    //  Forms are created form a JSON object
    //
    //  Forms layouts:
    //
    //      - default
    //      - inline
    //      - horizontal
    //
    //  Events:
    //
    //      formReady: triggered once the form has rendered
    //          arguments: formmodel, formscope
    //
    //      formFieldChange: triggered when a form field changes:
    //          arguments: formmodel, field (changed)
    //
    angular.module('lux.form', ['lux.form.utils'])
        //
        .constant('formDefaults', {
            // Default layout
            layout: 'default',
            //
            // for horizontal layout
            labelSpan: 2,
            showLabels: true,
            novalidate: true,
            //
            formErrorClass: 'form-error',
            FORMKEY: 'm__form'
        })
        //
        .constant('defaultFormElements', function () {
            return {
                'text': {element: 'input', type: 'text', editable: true, textBased: true},
                'date': {element: 'input', type: 'date', editable: true, textBased: true},
                'datetime': {element: 'input', type: 'datetime', editable: true, textBased: true},
                'datetime-local': {element: 'input', type: 'datetime-local', editable: true, textBased: true},
                'email': {element: 'input', type: 'email', editable: true, textBased: true},
                'month': {element: 'input', type: 'month', editable: true, textBased: true},
                'number': {element: 'input', type: 'number', editable: true, textBased: true},
                'password': {element: 'input', type: 'password', editable: true, textBased: true},
                'search': {element: 'input', type: 'search', editable: true, textBased: true},
                'tel': {element: 'input', type: 'tel', editable: true, textBased: true},
                'textarea': {element: 'textarea', editable: true, textBased: true},
                'time': {element: 'input', type: 'time', editable: true, textBased: true},
                'url': {element: 'input', type: 'url', editable: true, textBased: true},
                'week': {element: 'input', type: 'week', editable: true, textBased: true},
                //  Specialized editables
                'checkbox': {element: 'input', type: 'checkbox', editable: true, textBased: false},
                'color': {element: 'input', type: 'color', editable: true, textBased: false},
                'file': {element: 'input', type: 'file', editable: true, textBased: false},
                'range': {element: 'input', type: 'range', editable: true, textBased: false},
                'select': {element: 'select', editable: true, textBased: false},
                //  Pseudo-non-editables (containers)
                'checklist': {element: 'div', editable: false, textBased: false},
                'fieldset': {element: 'fieldset', editable: false, textBased: false},
                'div': {element: 'div', editable: false, textBased: false},
                'form': {element: 'form', editable: false, textBased: false},
                'radio': {element: 'div', editable: false, textBased: false},
                //  Non-editables (mostly buttons)
                'button': {element: 'button', type: 'button', editable: false, textBased: false},
                'hidden': {element: 'input', type: 'hidden', editable: false, textBased: false},
                'image': {element: 'input', type: 'image', editable: false, textBased: false},
                'legend': {element: 'legend', editable: false, textBased: false},
                'reset': {element: 'button', type: 'reset', editable: false, textBased: false},
                'submit': {element: 'button', type: 'submit', editable: false, textBased: false}
            };
        })
        //
        .factory('formElements', ['defaultFormElements', function (defaultFormElements) {
            return defaultFormElements;
        }])
        //
        .run(['$rootScope', '$lux', function (scope, $lux) {
            var formHandlers = {};
            $lux.formHandlers = formHandlers;

            formHandlers.reload = function () {
                $lux.window.location.reload();
            };

            formHandlers.redirectHome = function (response, scope) {
                var href = scope.formAttrs.redirectTo || '/';
                $lux.window.location.href = href;
            };

            formHandlers.login = function (response, scope) {
                var target = scope.formAttrs.action,
                    api = $lux.api(target);
                if (api)
                    api.token(response.data.token);
                $lux.window.location.href = lux.context.POST_LOGIN_URL || lux.context.LOGIN_URL;
            };

            //  Listen for a Lux form to be available
            //  If it uses the api for posting, register with it
            scope.$on('formReady', function (e, model, formScope) {
                var attrs = formScope.formAttrs,
                    action = attrs ? attrs.action : null,
                    actionType = attrs ? attrs.actionType : null;

                if (isObject(action) && actionType !== 'create') {
                    var api = $lux.api(action);
                    if (api) {
                        $lux.log.info('Form ' + formScope.formModelName + ' registered with "' +
                            api.toString() + '" api');
                        api.formReady(model, formScope);
                    }
                }
            });
        }])

        //
        // The formService is a reusable component for redering form fields
        .service('standardForm', ['$log', '$http', '$document', '$templateCache', 'formDefaults', 'formElements',
                                  function (log, $http, $document, $templateCache, formDefaults, formElements) {
            //
            var baseAttributes = ['id', 'name', 'title', 'style'],
                inputAttributes = extendArray([], baseAttributes, ['disabled', 'readonly', 'type', 'value', 'placeholder']),
                textareaAttributes = extendArray([], baseAttributes, ['disabled', 'readonly', 'placeholder', 'rows', 'cols']),
                buttonAttributes = extendArray([], baseAttributes, ['disabled']),
                // Don't include action in the form attributes
                formAttributes = extendArray([], baseAttributes, ['accept-charset','autocomplete',
                                                                  'enctype', 'method', 'novalidate', 'target']),
                validationAttributes = ['minlength', 'maxlength', 'min', 'max', 'required'],
                ngAttributes = ['disabled', 'minlength', 'maxlength', 'required'],
                elements = formElements();

            extend(this, {
                name: 'default',
                //
                className: '',
                //
                inputGroupClass: 'form-group',
                //
                inputHiddenClass: 'form-hidden',
                //
                inputClass: 'form-control',
                //
                buttonClass: 'btn btn-default',
                //
                template: function (url) {
                    return $http.get(url, {cache: $templateCache}).then(function (result) {
                        return result.data;
                    });
                },
                //
                // Create a form element
                createElement: function (driver, scope) {
                    var self = this,
                        thisField = scope.field,
                        tc = thisField.type.split('.'),
                        info = elements[tc.splice(0, 1)[0]],
                        renderer;

                    scope.extraClasses = tc.join(' ');
                    scope.info = info;

                    if (info) {
                        // Pick the renderer by checking `type`
                        if (info.hasOwnProperty('type'))
                            renderer = this[info.type];

                        // If no element type, use the `element`
                        if (!renderer)
                            renderer = this[info.element];
                    }

                    if (!renderer)
                        renderer = this.renderNotElements;

                    var element = renderer.call(this, scope);

                    forEach(scope.children, function (child) {
                        var field = child.field;

                        if (field) {

                            // extend child.field with options
                            forEach(formDefaults, function (_, name) {
                                if (field[name] === undefined)
                                    field[name] = scope.field[name];
                            });
                            //
                            // Make sure children is defined, otherwise it will be inherited from the parent scope
                            if (child.children === undefined)
                                child.children = null;
                            child = driver.createElement(extend(scope, child));

                            if (isArray(child))
                                forEach(child, function (c) {
                                    element.append(c);
                                });
                            else if (child)
                                element.append(child);
                        } else {
                            log.error('form child without field');
                        }
                    });
                    // Reinstate the field
                    scope.field = thisField;
                    return element;
                },
                //
                addAttrs: function (scope, element, attributes) {
                    forEach(scope.field, function (value, name) {
                        if (attributes.indexOf(name) > -1) {
                            if (ngAttributes.indexOf(name) > -1)
                                element.attr('ng-' + name, value);
                            else
                                element.attr(name, value);
                        } else if (name.substring(0, 5) === 'data-') {
                            element.attr(name, value);
                        }
                    });
                    return element;
                },
                //
                addDirectives: function(scope, element) {
                    // lux-codemirror directive
                    if (scope.field.hasOwnProperty('text_edit'))
                        element.attr('lux-codemirror', scope.field.text_edit);
                    return element;
                },
                //
                renderNotForm: function (scope) {
                    return $($document[0].createElement('span')).html(field.label || '');
                },
                //
                fillDefaults: function (scope) {
                    var field = scope.field;
                    field.label = field.label || field.name;
                    scope.formCount++;
                    if (!field.id)
                        field.id = field.name + '-' + scope.formid + '-' + scope.formCount;
                },
                //
                form: function (scope) {
                    var field = scope.field,
                        info = scope.info,
                        form = $($document[0].createElement(info.element))
                                    .attr('role', 'form').addClass(this.className)
                                    .attr('ng-model', field.model);
                    this.formMessages(scope, form);
                    return this.addAttrs(scope, form, formAttributes);
                },
                //
                'ng-form': function (scope) {
                    return this.form(scope);
                },
                //
                // Render a fieldset
                fieldset: function (scope) {
                    var field = scope.field,
                        info = scope.info,
                        element = $($document[0].createElement(info.element));
                    if (field.label)
                        element.append($($document[0].createElement('legend')).html(field.label));
                    return element;
                },
                //
                div: function (scope) {
                    var info = scope.info,
                        element = $($document[0].createElement(info.element)).addClass(scope.extraClasses);
                    return element;
                },
                //
                radio: function (scope) {
                    this.fillDefaults(scope);

                    var field = scope.field,
                        info = scope.info,
                        input = angular.element($document[0].createElement(info.element)),
                        label = angular.element($document[0].createElement('label')).attr('for', field.id),
                        span = angular.element($document[0].createElement('span'))
                                    .css('margin-left', '5px')
                                    .css('position', 'relative')
                                    .css('bottom', '2px')
                                    .html(field.label),
                        element = angular.element($document[0].createElement('div')).addClass(this.element);

                    input.attr('ng-model', scope.formModelName + '["' + field.name + '"]');

                    forEach(inputAttributes, function (name) {
                        if (field[name]) input.attr(name, field[name]);
                    });

                    label.append(input).append(span);
                    element.append(label);
                    return this.onChange(scope, this.inputError(scope, element));
                },
                //
                checkbox: function (scope) {
                    return this.radio(scope);
                },
                //
                input: function (scope, attributes) {
                    this.fillDefaults(scope);

                    var field = scope.field,
                        info = scope.info,
                        input = angular.element($document[0].createElement(info.element)).addClass(this.inputClass),
                        label = angular.element($document[0].createElement('label')).attr('for', field.id).html(field.label),
                        element;

                    // Add model attribute
                    input.attr('ng-model', scope.formModelName + '["' + field.name + '"]');

                    if (!field.showLabels || field.type === 'hidden') {
                        label.addClass('sr-only');
                        // Add placeholder if not defined
                        if (field.placeholder === undefined)
                            field.placeholder = field.label;
                    }

                    this.addAttrs(scope, input, attributes || inputAttributes);
                    if (field.value !== undefined) {
                        scope[scope.formModelName][field.name] = field.value;
                        if (info.textBased)
                            input.attr('value', field.value);
                    }

                    // Add directive to element
                    input = this.addDirectives(scope, input);

                    if (this.inputGroupClass) {
                        element = angular.element($document[0].createElement('div'));
                        if (field.type === 'hidden') element.addClass(this.inputHiddenClass);
                        else element.addClass(this.inputGroupClass);
                        element.append(label).append(input);
                    } else {
                        element = [label, input];
                    }
                    return this.onChange(scope, this.inputError(scope, element));
                },
                //
                textarea: function (scope) {
                    return this.input(scope, textareaAttributes);
                },
                //
                // Create a select element
                select: function (scope) {
                    var field = scope.field,
                        groups = {},
                        groupList = [],
                        options = [],
                        group;

                    forEach(field.options, function (opt) {
                        if (typeof(opt) === 'string') {
                            opt = {'value': opt};
                        } else if (isArray(opt)) {
                            opt = {'value': opt[0], 'repr': opt[1] || opt[0]};
                        }
                        if (opt.group) {
                            group = groups[opt.group];
                            if (!group) {
                                group = {name: opt.group, options: []};
                                groups[opt.group] = group;
                                groupList.push(group);
                            }
                            group.options.push(opt);
                        } else
                            options.push(opt);
                        // Set the default value if not available
                        if (!field.value) field.value = opt.value;
                    });

                    var info = scope.info,
                        element = this.input(scope);

                    if (elements.select.hasOwnProperty('widget') && elements.select.widget.name === 'selectUI')
                        // UI-Select widget
                        this.selectUI(scope, element, field, groupList, options);
                    else
                        // Standard select
                        this.selectStandard(scope, element, field, groupList, options);

                    return this.onChange(scope, element);
                },
                //
                // Standard select widget
                selectStandard: function(scope, element, field, groupList, options) {
                    var groups = {},
                        group, grp,
                        select = this._select(scope.info.element, element);

                    if (groupList.length) {
                        if (options.length)
                            groupList.push({name: 'other', options: options});

                        forEach(groupList, function (group) {
                            grp = $($document[0].createElement('optgroup'))
                                    .attr('label', group.name);
                            select.append(grp);
                            forEach(group.options, function (opt) {
                                opt = $($document[0].createElement('option'))
                                        .attr('value', opt.value).html(opt.repr || opt.value);
                                grp.append(opt);
                            });
                        });
                    } else {
                        forEach(options, function (opt) {
                            opt = $($document[0].createElement('option'))
                                    .attr('value', opt.value).html(opt.repr || opt.value);
                            select.append(opt);
                        });
                    }

                    if (field.multiple)
                        select.attr('multiple', true);
                },
                //
                // UI-Select widget
                selectUI: function(scope, element, field, groupList, options) {
                    //
                    scope.groupBy = function (item) {
                        return item.group;
                    };

                    scope.getValue = function(value) {
                        if (isObject(value)) {
                            return value.name || value.repr || value.id;
                        } else {
                            return value;
                        }
                    };

                    // Search specified global
                    scope.enableSearch = elements.select.widget.enableSearch;

                    // Search specified for field
                    if (field.hasOwnProperty('search'))
                        scope.enableSearch = field.search;

                    var selectUI = $($document[0].createElement('ui-select'))
                                    .attr('id', field.id)
                                    .attr('name', field.name)
                                    .attr('ng-model', scope.formModelName + '["' + field.name + '"]')
                                    .attr('theme', elements.select.widget.theme)
                                    .attr('search-enabled', 'enableSearch')
                                    .attr('ng-change', 'fireFieldChange("' + field.name + '")'),
                        match = $($document[0].createElement('ui-select-match'))
                                    .attr('placeholder', 'Select or search ' + field.label.toLowerCase()),
                        choices_inner = $($document[0].createElement('div')),
                        choices_inner_small = $($document[0].createElement('small')),
                        choices = $($document[0].createElement('ui-select-choices'))
                                    .append(choices_inner);

                    if (field.multiple)
                        selectUI.attr('multiple', true);

                    if (field.hasOwnProperty('data-remote-options')) {
                        // Add infinity scroll handler
                        selectUI.attr('select-infinity', 'loadMore()');

                        // Remote options
                        selectUI.attr('data-remote-options', field['data-remote-options'])
                                .attr('data-remote-options-id', field['data-remote-options-id'])
                                .attr('data-remote-options-value', field['data-remote-options-value']);
                                //.attr('data-remote-options-params', field['data-remote-options-params']);

                        if (field.multiple) {
                            selectUI.attr('on-select', 'multipleSelect($select, $model)');
                            match.html('{{getValue($item)}}');
                        } else {
                            // Add select handler only for non multiple field
                            // because multiple fields use separate url for initial options
                            selectUI.attr('on-select', 'selectValue($select)');
                            //match.html('{{getValue($select.selected)}}');
                            match.html('{{getValue($select.selected)}}');
                        }

                        choices.attr('repeat', field['data-ng-options-ui-select'])
                               .attr('refresh', 'remoteSearch($select,' + field.multiple + ')')
                               .attr('refresh-delay', 250);
                        choices_inner.html('{{item.name || item.id}}');
                    } else {
                        // Local options
                        var optsId = field.name + '_opts',
                            repeatItems = 'opt.value as opt in ' + optsId + ' | filter: $select.search';

                        if (field.multiple)
                            match.html('{{$item.value}}');
                        else
                            match.html('{{$select.selected.value}}');

                        if (groupList.length) {
                            // Groups require raw options
                            scope[optsId] = field.options;
                            choices.attr('group-by', 'groupBy')
                                   .attr('repeat', repeatItems);
                            choices_inner.attr('ng-bind-html', 'opt.repr || opt.value');
                        } else {
                            scope[optsId] = options;
                            choices.attr('repeat', repeatItems);

                            if (options.length > 0) {
                                var attrsNumber = Object.keys(options[0]).length;
                                choices_inner.attr('ng-bind-html', 'opt.repr || opt.value');

                                if (attrsNumber > 1) {
                                    choices_inner_small.attr('ng-bind-html', 'opt.value');
                                    choices.append(choices_inner_small);
                                }
                            }
                        }
                    }

                    selectUI.append(match);
                    selectUI.append(choices);
                    element[0].replaceChild(selectUI[0], element[0].childNodes[1]);
                },
                //
                button: function (scope) {
                    var field = scope.field,
                        info = scope.info,
                        element = $($document[0].createElement(info.element)).addClass(this.buttonClass);
                    field.name = field.name || info.element;
                    field.label = field.label || field.name;
                    element.html(field.label);
                    this.addAttrs(scope, element, buttonAttributes);
                    return this.onClick(scope, element);
                },
                //
                onClick: function (scope, element) {
                    var name = element.attr('name'),
                        field = scope.field,
                        clickname = name + 'Click',
                        self = this;
                    //
                    // scope function
                    scope[clickname] = function (e) {
                        if (scope.$broadcast(clickname, e).defaultPrevented) return;
                        if (scope.$emit(clickname, e).defaultPrevented) return;

                        // Get the form processing function
                        var callback = self.processForm(scope);
                        //
                        if (field.click) {
                            callback = getRootAttribute(field.click);
                            if (!angular.isFunction(callback)) {
                                log.error('Could not locate click function "' + field.click + '" for button');
                                return;
                            }
                        }
                        callback.call(this, e);
                    };
                    element.attr('ng-click', clickname + '($event)');
                    return element;
                },
                //
                //  Add change event
                onChange: function (scope, element) {
                    var field = scope.field,
                        input = $(element[0].querySelector(scope.info.element));
                    input.attr('ng-change', 'fireFieldChange("' + field.name + '")');
                    return element;
                },
                //
                // Add input error elements to the input element.
                // Each input element may have one or more error handler depending
                // on its type and attributes
                inputError: function (scope, element) {
                    var field = scope.field,
                        self = this,
                        // True when the form is submitted
                        submitted = scope.formName + '.submitted',
                        // True if the field is dirty
                        dirty = joinField(scope.formName, field.name, '$dirty'),
                        invalid = joinField(scope.formName, field.name, '$invalid'),
                        error = joinField(scope.formName, field.name, '$error') + '.',
                        input = $(element[0].querySelector(scope.info.element)),
                        p = $($document[0].createElement('p'))
                                .attr('ng-show', '(' + submitted + ' || ' + dirty + ') && ' + invalid)
                                .addClass('text-danger error-block')
                                .addClass(scope.formErrorClass),
                        value,
                        attrname;
                    // Loop through validation attributes
                    forEach(validationAttributes, function (attr) {
                        value = field[attr];
                        attrname = attr;
                        if (value !== undefined && value !== false && value !== null) {
                            if (ngAttributes.indexOf(attr) > -1) attrname = 'ng-' + attr;
                            input.attr(attrname, value);
                            p.append($($document[0].createElement('span'))
                                         .attr('ng-show', error + attr)
                                         .html(self.errorMessage(scope, attr)));
                        }
                    });

                    // Add the invalid handler if not available
                    var errors = p.children().length;
                    if (errors === (field.required ? 1 : 0)) {
                        var nameError = '$invalid';
                        if (errors)
                            nameError += ' && !' + [scope.formName, field.name, '$error.required'].join('.');
                        p.append(this.fieldErrorElement(scope, nameError, self.errorMessage(scope, 'invalid')));
                    }

                    // Add the invalid handler for server side errors
                    var name = '$invalid';
                        name += ' && !' + joinField(scope.formName, field.name, '$error.required');
                        p.append(
                            this.fieldErrorElement(scope, name, self.errorMessage(scope, 'invalid'))
                            .html('{{formErrors["' + field.name + '"]}}')
                        );

                    return element.append(p);
                },
                //
                fieldErrorElement: function (scope, name, msg) {
                    var field = scope.field,
                        value = joinField(scope.formName, field.name, name);

                    return $($document[0].createElement('span'))
                                .attr('ng-show', value)
                                .html(msg);
                },
                //
                // Add element which containes form messages and errors
                formMessages: function (scope, form) {
                    var messages = $($document[0].createElement('p')),
                        a = scope.formAttrs;
                    messages.attr('ng-repeat', 'message in formMessages.' + a.FORMKEY)
                            .attr('ng-bind', 'message.message')
                            .attr('ng-class', "message.error ? 'text-danger' : 'text-info'");
                    return form.append(messages);
                },
                //
                errorMessage: function (scope, attr) {
                    var message = attr + 'Message',
                        field = scope.field,
                        handler = this[attr+'ErrorMessage'] || this.defaultErrorMesage;
                    return field[message] || handler.call(this, scope);
                },
                //
                // Default error Message when the field is invalid
                defaultErrorMesage: function (scope) {
                    var type = scope.field.type;
                    return 'Not a valid ' + type;
                },
                //
                minErrorMessage: function (scope) {
                    return 'Must be greater than ' + scope.field.min;
                },
                //
                maxErrorMessage: function (scope) {
                    return 'Must be less than ' + scope.field.max;
                },
                //
                maxlengthErrorMessage: function (scope) {
                    return 'Too long, must be less than ' + scope.field.maxlength;
                },
                //
                minlengthErrorMessage: function (scope) {
                    return 'Too short, must be more than ' + scope.field.minlength;
                },
                //
                requiredErrorMessage: function (scope) {
                    return scope.field.label + " is required";
                },
                //
                // Return the function to handle form processing
                processForm: function (scope) {
                    return scope.processForm || lux.processForm;
                },
                //
                _select: function (tag, element) {
                    if (isArray(element)) {
                        for (var i=0; i<element.length; ++i) {
                            if (element[0].tagName === tag)
                                return element;
                        }
                    } else {
                        return $(element[0].querySelector(tag));
                    }
                }
            });
        }])
        //
        // Bootstrap Horizontal form renderer
        .service('horizontalForm', ['$document', 'standardForm',
                                    function ($document, standardForm) {
            //
            // extend the standardForm service
            extend(this, standardForm, {

                name: 'horizontal',

                className: 'form-horizontal',

                input: function (scope) {
                    var element = standardForm.input(scope),
                        children = element.children(),
                        labelSpan = scope.field.labelSpan ? +scope.field.labelSpan : 2,
                        wrapper = $($document[0].createElement('div'));
                    labelSpan = Math.max(2, Math.min(labelSpan, 10));
                    $(children[0]).addClass('control-label col-sm-' + labelSpan);
                    wrapper.addClass('col-sm-' + (12-labelSpan));
                    for (var i=1; i<children.length; ++i)
                        wrapper.append($(children[i]));
                    return element.append(wrapper);
                },

                button: function (scope) {
                    var element = standardForm.button(scope),
                        labelSpan = scope.field.labelSpan ? +scope.field.labelSpan : 2,
                        outer = $($document[0].createElement('div')).addClass(this.inputGroupClass),
                        wrapper = $($document[0].createElement('div'));
                    labelSpan = Math.max(2, Math.min(labelSpan, 10));
                    wrapper.addClass('col-sm-offset-' + labelSpan)
                           .addClass('col-sm-' + (12-labelSpan));
                    outer.append(wrapper.append(element));
                    return outer;
                }
            });
        }])
        //
        .service('inlineForm', ['standardForm', function (standardForm) {
            extend(this, standardForm, {

                name: 'inline',

                className: 'form-inline',

                input: function (scope) {
                    var element = standardForm.input(scope);
                    $(element[0].getElementsByTagName('label')).addClass('sr-only');
                    return element;
                }
            });
        }])
        //
        .service('formBaseRenderer', ['$lux', '$compile', 'formDefaults',
                function ($lux, $compile, formDefaults) {
            //
            // Internal function for compiling a scope
            this.createElement = function (scope) {
                var field = scope.field;

                if (this[field.layout])
                    return this[field.layout].createElement(this, scope);
                else
                    $lux.log.error('Layout "' + field.layout + '" not available, cannot render form');
            };
            //
            // Initialise the form scope
            this.initScope = function (scope, element, attrs) {
                var data = getOptions(attrs);

                // No data, maybe this form was loaded via angular ui router
                // try to evaluate internal scripts
                if (!data) {
                    var scripts= element[0].getElementsByTagName('script');
                    forEach(scripts, function (js) {
                        globalEval(js.innerHTML);
                    });
                    data = getOptions(attrs);
                }

                if (data && data.field) {
                    var form = data.field,
                        formmodel = {};

                    // extend with form defaults
                    data.field = extend({}, formDefaults, form);
                    extend(scope, data);
                    form = scope.field;
                    if (form.model) {
                        if (!form.name)
                            form.name = form.model + 'form';
                        scope.$parent[form.model] = formmodel;
                    } else {
                        if (!form.name)
                            form.name = 'form';
                        form.model = form.name + 'Model';
                    }
                    scope.formName = form.name;
                    scope.formModelName = form.model;
                    //
                    scope[scope.formModelName] = formmodel;
                    scope.formAttrs = form;
                    scope.formClasses = {};
                    scope.formErrors = {};
                    scope.formMessages = {};
                    scope.$lux = $lux;
                    if (!form.id)
                        form.id = 'f' + s4();
                    scope.formid = form.id;
                    scope.formCount = 0;

                    scope.addMessages = function (messages, error) {

                        forEach(messages, function (message) {
                            if (isString(message))
                                message = {message: message};

                            var field = message.field;
                            if (field && !scope[scope.formName].hasOwnProperty(field)) {
                                message.message = field + ' ' + message.message;
                                field = formDefaults.FORMKEY;
                            } else if (!field) {
                                field = formDefaults.FORMKEY;
                            }

                            if (error) message.error = error;

                            scope.formMessages[field] = [message];

                            if (message.error && field !== formDefaults.FORMKEY) {
                                scope.formErrors[field] = message.message;
                                scope[scope.formName][field].$invalid = true;
                            }
                        });
                    };

                    scope.fireFieldChange = function (field) {
                        // Triggered every time a form field changes
                        scope.$broadcast('fieldChange', formmodel, field);
                        scope.$emit('formFieldChange', formmodel, field);
                    };
                } else {
                    $lux.log.error('Form data does not contain field entry');
                }
            };
            //
            this.createForm = function (scope, element) {
                var form = scope.field;
                if (form) {
                    var formElement = this.createElement(scope);
                    //  Compile and update DOM
                    if (formElement) {
                        this.preCompile(scope, formElement);
                        $compile(formElement)(scope);
                        element.replaceWith(formElement);
                        this.postCompile(scope, formElement);
                    }
                }
            };

            this.preCompile = function () {};

            this.postCompile = function () {};

            this.checkField = function (name) {
                var checker = this['check_' + name];
                // There may be a custom field checker
                if (checker)
                    checker.call(this);
                else {
                    var field = this.form[name];
                    if (field.$valid)
                        this.formClasses[name] = 'has-success';
                    else if (field.$dirty) {
                        this.formErrors[name] = name + ' is not valid';
                        this.formClasses[name] = 'has-error';
                    }
                }
            };

            this.processForm = function(scope) {
                // Clear form errors and messages
                scope.formMessages = [];
                scope.formErrors = [];

                if (scope.form.$invalid) {
                    return $scope.showErrors();
                }
            };
        }])
        //
        // Default form Renderer, roll your own if you like
        .service('formRenderer', ['formBaseRenderer', 'standardForm', 'horizontalForm', 'inlineForm',
            function (base, stdForm, horForm, inlForm) {
                var renderer = extend(this, base);
                this[stdForm.name] = stdForm;
                this[horForm.name] = horForm;
                this[inlForm.name] = inlForm;

                // Create the directive
                this.directive = function () {

                    return {
                        restrict: "AE",
                        //
                        scope: {},
                        //
                        compile: function () {
                            return {
                                pre: function (scope, element, attr) {
                                    // Initialise the scope from the attributes
                                    renderer.initScope(scope, element, attr);
                                },
                                post: function (scope, element) {
                                    // create the form
                                    renderer.createForm(scope, element);
                                    // Emit the form upwards through the scope hierarchy
                                    scope.$emit('formReady', scope[scope.formModelName], scope);
                                }
                            };
                        }
                    };
                };
            }
        ])
        //
        // Lux form
        .directive('luxForm', ['formRenderer', function (formRenderer) {
            return formRenderer.directive();
        }])
        //
        .directive("checkRepeat", ['$log', function (log) {
            return {
                require: "ngModel",

                restrict: 'A',

                link: function(scope, element, attrs, ctrl) {
                    var other = element.inheritedData("$formController")[attrs.checkRepeat];
                    if (other) {
                        ctrl.$parsers.push(function(value) {
                            if(value === other.$viewValue) {
                                ctrl.$setValidity("repeat", true);
                                return value;
                            }
                            ctrl.$setValidity("repeat", false);
                        });

                        other.$parsers.push(function(value) {
                            ctrl.$setValidity("repeat", value === ctrl.$viewValue);
                            return value;
                        });
                    } else {
                        log.error('Check repeat directive could not find ' + attrs.checkRepeat);
                    }
                 }
            };
        }])
        //
        // A directive which add keyup and change event callaback
        .directive('watchChange', function() {
            return {
                scope: {
                    onchange: '&watchChange'
                },
                //
                link: function(scope, element, attrs) {
                    element.on('keyup', function() {
                        scope.$apply(function () {
                            scope.onchange();
                        });
                    }).on('change', function() {
                        scope.$apply(function () {
                            scope.onchange();
                        });
                    });
                }
            };
        });
