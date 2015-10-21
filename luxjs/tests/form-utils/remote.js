 // Utility for creating a JSON form for testing
    var testFormUtils = {
        createForm: function () {
            var form = {
                field: {
                    type: 'form'
                },
                children: []
            };
            lux.forEach(arguments, function (attrs) {
                form['children'].push({field: attrs});
            });
            return form;
        },
        digest: function ($compile, $rootScope, template) {
            var scope = $rootScope.$new(),
                element = $compile(template)(scope);
            scope.$digest();
            return element;
        }
    };

    describe("Test lux.form.utils", function() {

        // Angular module for select-UI forms
        angular.module('lux.form.utils.test.selectui', ['lux.form'])

            .factory('formElements', ['defaultFormElements', function (defaultFormElements) {
                return function () {
                    var elements = defaultFormElements();
                    elements.select.widget = {
                        name: 'selectUI',
                        enableSearch: true,
                        theme: 'bootstrap'
                    };
                    return elements;
                };
            }]);

        //
        lux.formSelectUITests = {};

        var controller;
        var api;
        var $scope;
        var $compile;
        var $rootScope;
        var $httpBackend;
        var $document;
        var element;
        var $lux = angular.injector(['lux.tests.mocks']).get('$lux');
        var windowFake = {
            lux: {
                context: {
                    API_URL: 'dummy',
                }
            }
        };

        var apiMock;
        var qMock;
        var dataProvider;
        var target = { url: 'dummy://url'};
        var subPath = 'dummy/subPath';
        var options = { dummy: 'options' };

        beforeEach(function () {
            module('lux.form.utils.test.selectui');

            $document = angular.element(document);

            angular.mock.module('lux.form.utils', function($provide) {
                $provide.value('$lux', $lux);
                $provide.value('$window', windowFake);
                $provide.value('$document', $document);
            });

            api = $lux.api();
            $lux.resetAllSpies();

            inject(function (_$compile_, _$rootScope_, _$httpBackend_) {
                $compile = _$compile_;
                $rootScope = _$rootScope_;
                $httpBackend = _$httpBackend_;

                $rootScope.formModelName = 'UserForm';
                $rootScope.UserForm = {
                    users_url: [{}]
                };
            });
        });

        it("call directive", function() {
            lux.formSelectUITests.select = testFormUtils.createForm({
                type: 'select',
                name: 'choice',
            });
            var element = testFormUtils.digest($compile, $rootScope,
                "<div><lux-form data-options='lux.formSelectUITests.select'" +
                                "data-remote-options='{\"url\": \"dummy://url\", \"name\": \"users_url\"}'>" +
                        "</lux-form></div>");

            expect(api.get).toHaveBeenCalledWith(null, {limit:25, offset:0, id:null});
        });

        it("check params", function() {
            lux.formSelectUITests.select = testFormUtils.createForm({
                type: 'select',
                name: 'choice',
            });


            var element = testFormUtils.digest($compile, $rootScope,
                "<div><lux-form data-options='lux.formSelectUITests.select'" +
                                "data-remote-options='{\"url\": \"dummy://url\", \"name\": \"users_url\"}'" +
                                "data-remote-options-id='username'>" +
                        "</lux-form></div>");

            //expect(api.get).toHaveBeenCalledWith(null, {limit:25, offset:0, username:null});

            var thenSpy = $lux.getLastThenSpy();
            expect(thenSpy).toHaveBeenCalledWith(jasmine.any(Function), jasmine.any(Function));
            var successCallback = thenSpy.calls.mostRecent().args[0];
            successCallback({
                data: {
                    result: [
                        {
                            name: 'My Dataset',
                            symbol: 'mse'
                        }
                    ]
                }
            });

            //expect(controller.list).toEqual({ 'mse': 'My Dataset' });
            expect(api.get).toHaveBeenCalledWith(null, {limit:25, offset:0, username:null});

        });
    });
