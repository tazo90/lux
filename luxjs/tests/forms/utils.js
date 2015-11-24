define(function(require) {

    angular.module('lux.form.utils.test', [])
        .factory('$lux', function() {
            var thenSpy = jasmine.createSpy();
            var luxApiMock = {
                get: jasmine.createSpy(),
                post: function() {
                    return {
                        then: function() {}
                    }
                }
            };
            luxApiMock.get.and.returnValue({
                then: thenSpy
            });

            var luxMock = {
                api: function(url) {
                    return luxApiMock;
                },
                getLastThenSpy: function() {
                    return thenSpy;
                },
                resetAllSpies: function() {
                    thenSpy.calls.reset();
                    luxApiMock.get.calls.reset();
                }
            };

            return luxMock;
        });

    describe("Test lux.form.utils", function() {
        //
        lux.formUtilsTests = {};

        var api;
        var scope;
        var $compile;
        var $rootScope;
        var $lux = angular.injector(['lux.form.utils.test']).get('$lux');
        var windowFake = {
            lux: {
                context: {
                    API_URL: 'dummy',
                }
            }
        };

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
            digest: function ($compile, scope, template) {
                element = $compile(template)(scope);
                scope.$digest();
                return element;
            }
        };

        beforeEach(function () {
            angular.mock.module('lux.form.utils', function($provide) {
                $provide.value('$lux', $lux);
                $provide.value('$window', windowFake);
            });

            api = $lux.api();
            $lux.resetAllSpies();

            inject(function (_$compile_, _$rootScope_) {
                $compile = _$compile_;
                $rootScope = _$rootScope_;

                scope = $rootScope.$new();
                scope.formModelName = 'UserForm';
                scope.UserForm = {
                    users: [{
                      id: 1,
                      name: 'test_option'
                    }]
                };
                scope.selection = {};
            });
        });

        it("call directive", function() {
            lux.formUtilsTests.form1 = testFormUtils.createForm({
                type: 'select',
                name: 'choice',
            });

            var element = testFormUtils.digest($compile, scope,
                "<div><lux-form data-options='lux.formUtilsTests.form1'" +
                                "data-remote-options='{\"url\": \"dummy://url\", \"name\": \"users_url\"}'>" +
                        "</lux-form></div>");

            expect(api.get).toHaveBeenCalledWith(null, {limit:25, offset:0});
        });

        it("check remoteSearch()", function() {
            lux.formUtilsTests.form2 = testFormUtils.createForm({
                type: 'select',
                name: 'choice',
            });

            var element = testFormUtils.digest($compile, scope,
                "<div><lux-form data-options='lux.formUtilsTests.form2'" +
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
            $lux.resetAllSpies();
            // Many to many field
            sc.remoteSearch(select, true);
            expect(api.get).toHaveBeenCalledWith(null, {limit:25, offset:0, name:'test_user'});
            // Check empty
            $lux.resetAllSpies();
            select = {search: ''};
            sc.remoteSearch(select, false);
            expect(api.get).toHaveBeenCalledWith(null, {limit:25, offset:0});
        });

        it("check multipleSelect()", function() {
            lux.formUtilsTests.form3 = testFormUtils.createForm({
                type: 'select',
                name: 'choice',
            });

            var element = testFormUtils.digest($compile, scope,
                "<div><lux-form data-options='lux.formUtilsTests.form3'" +
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
            lux.formUtilsTests.form4 = testFormUtils.createForm({
                type: 'select',
                name: 'choice',
            });

            var element = testFormUtils.digest($compile, scope,
                "<div><lux-form data-options='lux.formUtilsTests.form4'" +
                                "data-remote-options='{\"url\": \"dummy://url\", \"name\": \"users_url\"}'" +
                                "data-remote-options-id='username' data-name='users'>" +
                        "</lux-form></div>");


            sc = element.scope();
            // First call
            sc.loadMore();
            expect(api.get).toHaveBeenCalled();
            // Second call
            sc.loadMore();
            expect(api.get).toHaveBeenCalled();
        });

        it("populate options with response data on successful completion of get", function() {
            lux.formUtilsTests.form5 = testFormUtils.createForm({
                type: 'select',
                name: 'choice',
            });

            var element = testFormUtils.digest($compile, scope,
                "<div><lux-form data-options='lux.formUtilsTests.form5'" +
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
});
