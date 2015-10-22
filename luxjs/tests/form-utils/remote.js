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

        var api;
        var scope;
        var $timeout;
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

            inject(function (_$timeout_, _$compile_, _$rootScope_, _$httpBackend_) {
                $timeout = _$timeout_;
                $compile = _$compile_;
                $rootScope = _$rootScope_;
                $httpBackend = _$httpBackend_;

                $rootScope.formModelName = 'UserForm';
                $rootScope.UserForm = {
                    users: [{
                      id: 1,
                      name: 'test_option'
                    }]
                };

                scope = $rootScope.$new();
            });

            lux.formSelectUITests.select = testFormUtils.createForm({
                type: 'select',
                name: 'choice',
            });
        });

        it("call directive", function() {
            var element = testFormUtils.digest($compile, $rootScope,
                "<div><lux-form data-options='lux.formSelectUITests.select'" +
                                "data-remote-options='{\"url\": \"dummy://url\", \"name\": \"users_url\"}'>" +
                        "</lux-form></div>");

            expect(api.get).toHaveBeenCalledWith(null, {limit:25, offset:0, id:null});
        });

        it("check params", function() {
            var element = testFormUtils.digest($compile, $rootScope,
                "<div><lux-form data-options='lux.formSelectUITests.select'" +
                                "data-remote-options='{\"url\": \"dummy://url\", \"name\": \"users_url\"}'" +
                                "data-remote-options-id='username'>" +
                        "</lux-form></div>");

            expect(api.get).toHaveBeenCalledWith(null, {limit:25, offset:0, username:null});
        });

        it("check remoteSearch()", function() {
            var element = testFormUtils.digest($compile, $rootScope,
                "<div><lux-form data-options='lux.formSelectUITests.select'" +
                                "data-remote-options='{\"url\": \"dummy://url\", \"name\": \"users_url\"}'" +
                                "data-remote-options-id='username'>" +
                        "</lux-form></div>");

            var select = {
              search: 'test_user'
            };

            sc = element.scope();
            // One to many field
            sc.remoteSearch(select, false);
            expect(api.get).toHaveBeenCalledWith(null, {limit:25, offset:0, username:'test_user'});
            // Many to many field
            sc.remoteSearch(select, true);
            expect(api.get).toHaveBeenCalledWith(null, {limit:25, offset:0, name:'test_user'});
            // Check empty
            select = {search: ''};
            sc.remoteSearch(select, false);
            expect(api.get).toHaveBeenCalledWith(null, {limit:25, offset:0, name:null});
        });

        it("check multipleSelect()", function() {
            var element = testFormUtils.digest($compile, $rootScope,
                "<div><lux-form data-options='lux.formSelectUITests.select'" +
                                "data-remote-options='{\"url\": \"dummy://url\", \"name\": \"users_url\"}'" +
                                "data-remote-options-id='username' data-multiple='' data-name='users'>" +
                        "</lux-form></div>");

            var select = {
              selected: []
            };

            expect(scope.UserForm.users.length).toBe(1);
            sc = element.scope();
            sc.multipleSelect(select, '');
            expect(scope.UserForm.users.length).toBe(0);
        });

        it("check loadMore()", function() {
            var element = testFormUtils.digest($compile, $rootScope,
                "<div><lux-form data-options='lux.formSelectUITests.select'" +
                                "data-remote-options='{\"url\": \"dummy://url\", \"name\": \"users_url\"}'" +
                                "data-remote-options-id='username' data-name='users'>" +
                        "</lux-form></div>");


            sc = element.scope();
            sc.loadMore();
            $timeout.flush();
            expect(api.get).toHaveBeenCalled();
        });

        it("populate options with response data on successful completion of get", function() {
            var element = testFormUtils.digest($compile, $rootScope,
                "<div><lux-form data-options='lux.formSelectUITests.select'" +
                                "data-remote-options='{\"url\": \"dummy://url\", \"name\": \"users_url\"}'" +
                                "data-remote-options-id='username' data-name='users'>" +
                        "</lux-form></div>");

            sc = element.scope();
            var thenSpy = $lux.getLastThenSpy();
            expect(thenSpy).toHaveBeenCalledWith(jasmine.any(Function), jasmine.any(Function));
            expect(sc.users_url.length).toBe(1);

            var successCallback = thenSpy.calls.mostRecent().args[0];
            successCallback({
                data: {
                    result: [
                        {
                            id: 2,
                            name: 'user_test'
                        }
                    ]
                }
            });

            expect(sc.users_url.length).toBe(2);
        });
    });
