define(function(require) {

    describe("Test lux.form module", function() {

        var $lux;
        var successMessageSpy;
        var errorMessageSpy;
        var scope;

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
                scope = $rootScope.$new();
                var element = $compile(template)(scope);
                scope.$digest();
                return element;
            }
        };

        lux.formTests = {};

        beforeEach(function () {
            apiMock = createLuxApiMock();
            var $luxMock = createLuxMock(apiMock);

            angular.mock.module('lux.form', function($provide) {
                $provide.value('$lux', $luxMock);
            });

            inject(function (_$lux_) {
                $lux = _$lux_;
            });

            successMessageSpy = jasmine.createSpy();
            errorMessageSpy = jasmine.createSpy();

            $lux.messages = {};
            $lux.messages.success = successMessageSpy;
            $lux.messages.error = errorMessageSpy;
        });

        afterEach(function () {
        });

        it("basic input tests", inject(function($compile, $rootScope) {
            lux.formTests.vForm1 = testFormUtils.createForm({
                type: 'email',
                name: 'login',
                required: true
            });

            var element = testFormUtils.digest($compile, $rootScope,
                '<div><lux-form data-options="lux.formTests.vForm1"></lux-form></div>'),
                form = element.children();
            //
            var tags = form.children().children();
            expect(tags[0].tagName).toBe('LABEL');
            expect(tags[1].tagName).toBe('INPUT');

            expect(tags[1].required).toBe(true);
            expect(tags[1].type).toBe('email');
            expect(tags[1].name).toBe('login');
        }));

        it("on success, email validate", inject(function($compile, $rootScope) {
            lux.formTests.vForm2 = testFormUtils.createForm({
                type: 'email',
                name: 'login',
                required: true
            });

            var element = testFormUtils.digest($compile, $rootScope,
                '<div><lux-form data-options="lux.formTests.vForm2"></lux-form></div>');

            var form = angular.element(element).find('form');
            scope = form.scope();
            scope.form.login.$setViewValue('user@example.com');

            expect(scope.form.login.$valid).toBe(true);
            expect(scope.form.login.$invalid).toBe(false);
        }));

        it("on failure, email validate", inject(function($compile, $rootScope) {
            lux.formTests.vForm3 = testFormUtils.createForm({
                type: 'email',
                name: 'login',
                required: true
            });

            var element = testFormUtils.digest($compile, $rootScope,
                '<div><lux-form data-options="lux.formTests.vForm3"></lux-form></div>');

            var form = angular.element(element).find('form');
            scope = form.scope();
            scope.form.login.$setViewValue('example.com');

            expect(scope.form.login.$valid).toBe(false);
            expect(scope.form.login.$invalid).toBe(true);
        }));

        it('submit empty email field', inject(function($compile, $rootScope) {
            lux.formTests.vForm4 = testFormUtils.createForm({
                type: 'email',
                name: 'login',
                required: true
            });

            var element = testFormUtils.digest($compile, $rootScope,
                '<div><lux-form data-options="lux.formTests.vForm4"></lux-form></div>');

            var _form = angular.element(element).find('form');
            var validators = _form.find('span');
            scope = _form.scope();

            // Submit empty field
            scope.form.login.$setViewValue('');
            scope.form.$setSubmitted(true);
            scope.$digest();
            expect(validators.eq(0).hasClass('ng-hide')).toBe(false);
            expect(validators.eq(1).hasClass('ng-hide')).toBe(true);
            expect(validators.eq(2).hasClass('ng-hide')).toBe(true);
        }));

        it('submit valid email field', inject(function($compile, $rootScope) {
            lux.formTests.vForm5 = testFormUtils.createForm({
                type: 'email',
                name: 'login',
                required: true
            });

            var element = testFormUtils.digest($compile, $rootScope,
                '<div><lux-form data-options="lux.formTests.vForm5"></lux-form></div>');

            var _form = angular.element(element).find('form');
            var validators = _form.find('span');
            scope = _form.scope();

            // Submit invalid email (angular validation)
            scope.form.login.$setViewValue('test@example.com');
            scope.form.$setSubmitted(true);
            scope.$digest();
            expect(validators.eq(0).hasClass('ng-hide')).toBe(true);
            expect(validators.eq(1).hasClass('ng-hide')).toBe(true);
            expect(validators.eq(2).hasClass('ng-hide')).toBe(true);
        }));

        it('submit invalid email field', inject(function($compile, $rootScope) {
            lux.formTests.vForm6 = testFormUtils.createForm({
                type: 'email',
                name: 'login',
                required: true
            });

            var element = testFormUtils.digest($compile, $rootScope,
                '<div><lux-form data-options="lux.formTests.vForm6"></lux-form></div>');

            var _form = angular.element(element).find('form');
            var validators = _form.find('span');
            scope = _form.scope();

            // Submit invalid email (angular validation)
            scope.form.login.$setViewValue('invalid_email');
            scope.form.$setSubmitted(true);
            scope.$digest();
            expect(validators.eq(0).hasClass('ng-hide')).toBe(true);
            expect(validators.eq(1).hasClass('ng-hide')).toBe(false);
            expect(validators.eq(2).hasClass('ng-hide')).toBe(true);
        }));

        function createLuxMock(apiMock) {
            var $luxMock = {
                api: function() {
                    return apiMock;
                }
            };

            return $luxMock;
        }

        function createLuxApiMock() {
            var apiMock = {
                get: jasmine.createSpy(),
                delete: jasmine.createSpy(),
                success: jasmine.createSpy(),
                error: jasmine.createSpy()
            };

            apiMock.get.and.returnValue(apiMock);
            apiMock.delete.and.returnValue(apiMock);
            apiMock.success.and.returnValue(apiMock);
            apiMock.error.and.returnValue(apiMock);

            return apiMock;
        }
    });

});
