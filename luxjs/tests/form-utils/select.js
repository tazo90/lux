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

    describe("Test lux.form with selectUI", function() {

        // Angular module for select-UI forms
        angular.module('lux.form.test.selectui', ['lux.form'])

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

        var apiMock;
        var qMock;
        var dataProvider;
        var target = { url: 'dummy://url'};
        var subPath = 'dummy/subPath';
        var options = { dummy: 'options' };

        beforeEach(function () {
            module('lux.form.test.selectui');

            apiMock = createLuxApiMock();
            qMock = createLuxQMock();
            var $luxMock = createLuxMock(apiMock, qMock);

            angular.mock.module('lux.form.utils', function($provide) {
                $provide.value('$lux', $luxMock);
            });

        });

        it("select input + widget", inject(function($httpBackend, $compile, $rootScope) {

            lux.formSelectUITests.select = testFormUtils.createForm({
                type: 'select',
                name: 'choice',
                required: true,
                options: ['one', 'two', 'three']
            });

            $rootScope.formModelName = 'UserForm';
            $rootScope.UserForm = {
                users_url: [{
                    id: 1,
                    name: 'test1',
                }, {
                    id: 2,
                    name: 'test2'
                }]
            };

            var element = testFormUtils.digest($compile, $rootScope,
                "<div><lux-form data-options='lux.formSelectUITests.select' data-remote-options='{\"url\": \"http://localhost:6050\", \"name\": \"users_url\"}'></lux-form></div>"),
                form = element.children();
            //
            //
        }));

        function createLuxMock(apiMock, qMock) {
            var $luxMock = {
                api: function() {
                    return apiMock;
                },
                q: function() {
                    return qMock;
                }
            };

            return $luxMock;
        }

        function createLuxApiMock() {
            var apiMock = {
                get: jasmine.createSpy(),
                delete: jasmine.createSpy(),
                success: jasmine.createSpy(),
                error: jasmine.createSpy(),
            };

            apiMock.get.and.returnValue(apiMock);
            apiMock.delete.and.returnValue(apiMock);
            apiMock.success.and.returnValue(apiMock);
            apiMock.error.and.returnValue(apiMock);

            return apiMock;
        }

        function createLuxQMock() {
            var qMock = {
                defer: jasmine.createSpy(),
            };

            qMock.defer.and.returnValue(qMock);

            return qMock;
        }
    });
