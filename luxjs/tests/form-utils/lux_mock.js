angular.module('lux.tests.mocks', [])
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
