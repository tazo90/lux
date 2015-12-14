
    //
    //  Lux Navigation module
    //  ============================
    //
    //  * Requires ``lux.bs`` for the collapsable directives
    //
    //  Html:
    //
    //      <navbar data-options="lux.context.navbar"></navbar>
    //
    //  Js:
    //
    //      lux.context.navbar = {
    //          id: null,           //  id attribute of the nav tag
    //          brand: null,        //  brand text to be displayed
    //          brandImage: null    //  brand image to be displayed rather than text. If available
    //                              //  the `brand` text is placed in the `alt` attribute
    //          url: "/",           //  href of the brand (if brand is defined)
    //      };
    //
    var navBarDefaults = {
        collapseWidth: 768,
        theme: 'default',
        search_text: '',
        collapse: '',
        // Navigation place on top of the page (add navbar-static-top class to navbar)
        // nabar2 it is always placed on top
        top: false,
        // Fixed navbar
        fixed: false,
        search: false,
        url: lux.context.url,
        target: '_self',
        toggle: true,
        fluid: true
    };

    angular.module('lux.nav', ['templates-nav', 'lux.bs'])
        //
        .service('linkService', ['$location', '$window', function ($location, $window) {

            this.initScope = function (scope, opts) {

                scope.clickLink = function (e, link) {
                    if (link.action) {
                        var func = scope[link.action];
                        if (func)
                            func(e, link.href, link);
                    }

                    // This patches an Angular bug with touch,
                    // whereby ng-click prevents href from working
                    var href = angular.element(e.currentTarget).attr('href');
                    if (e.type === 'touchend' && href) {
                        $window.location.assign(href);
                    }
                };

                // recursively loops through arrays to
                // find url match
                function exploreSubmenus(array) {
                    for (var i=0; i < array.length; i++) {
                        if (array[i].href === $location.path()) {
                            return true;
                        } else if (array[i].subitems && array[i].subitems.length > 0) {
                            if (exploreSubmenus(array[i].subitems)) return true;
                        }
                    }
                }

                scope.activeSubmenu = function(url) {
                    var active = false;

                    if (url.href && url.href === '#' && url.subitems.length > 0) {
                        active = exploreSubmenus(url.subitems);
                    } else {
                        active = false;
                    }
                    return active;
                };

                // Check if a url is active
                scope.activeLink = function (url) {
                    var loc;
                    if (url)
                        // Check if any submenus/sublinks are active
                        if (url.subitems && url.subitems.length > 0) {
                            if (exploreSubmenus(url.subitems)) return true;
                        }
                        url = typeof(url) === 'string' ? url : url.href || url.url;
                    if (!url) return;
                    if (isAbsolute.test(url))
                        loc = $location.absUrl();
                    else
                        loc = $location.path();
                    var rest = loc.substring(url.length),
                        base = url.length < loc.length ? false : loc.substring(0, url.length),
                        folder = url.substring(url.length-1) === '/';
                    return base === url && (folder || (rest === '' || rest.substring(0, 1) === '/'));
                };
            };
        }])

        .service('navService', ['linkService', function (linkService) {

            this.initScope = function (scope, opts) {

                var navbar = extend({}, navBarDefaults, scope.navbar, getOptions(opts));
                if (!navbar.url)
                    navbar.url = '/';
                if (!navbar.themeTop)
                    navbar.themeTop = navbar.theme;
                navbar.container = navbar.fluid ? '' : 'container';

                this.maybeCollapse(navbar);

                linkService.initScope(scope);

                scope.navbar = navbar;

                return navbar;
            };

            this.maybeCollapse = function (navbar) {
                var width = window.innerWidth > 0 ? window.innerWidth : screen.width,
                    c = navbar.collapse;

                if (width < navbar.collapseWidth)
                    navbar.collapse = 'collapse';
                else
                    navbar.collapse = '';
                return c !== navbar.collapse;
            };

            this.collapseForWide = function(navbar, element) {
                var width = window.innerWidth > 0 ? window.innerWidth : screen.width,
                    c = navbar.collapse;

                if (width > navbar.collapseWidth || navbar.collapse === '') {
                    // If dropdown was opened then collapse
                    if (element.find('nav')[1].classList.contains('in'))
                        navbar.collapse = 'collapse';
                }
                return c !== navbar.collapse;
            };
        }])
        //
        .directive('fullPage', ['$window', function ($window) {

            return {
                restrict: 'AE',

                link: function (scope, element, attrs) {
                    element.css('min-height', $window.innerHeight+'px');

                    scope.$watch(function(){
                        return $window.innerHeight;
                    }, function(value) {
                        element.css('min-height', value+'px');
                    });
                }
            };
        }])
        //
        .directive('navbarLink', function () {
            return {
                templateUrl: "nav/templates/link.tpl.html",
                restrict: 'A'
            };
        })
        //
        //  Directive for the simple navbar
        //  This directive does not require the Navigation controller
        //      - items         -> Top left navigation
        //      - itemsRight    -> Top right navigation
        .directive('navbar', ['navService', function (navService) {
            //
            return {
                templateUrl: "nav/templates/navbar.tpl.html",
                restrict: 'AE',
                // Link function
                link: function (scope, element, attrs) {
                    navService.initScope(scope, attrs);
                    //
                    windowResize(function () {
                        if (navService.collapseForWide(scope.navbar, element))
                            scope.$apply();
                    });
                    //
                    // When using ui-router, and a view changes collapse the
                    //  navigation if needed
                    scope.$on('$locationChangeSuccess', function () {
                        navService.maybeCollapse(scope.navbar);
                        //scope.$apply();
                    });
                }
            };
        }])
        //
        //  Directive for the navbar with sidebar (nivebar2 template)
        //      - items         -> Top left navigation
        //      - itemsRight    -> Top right navigation
        //      - items2        -> side navigation
        .directive('navbar2', ['navService', '$compile', function (navService, $compile) {
            return {
                restrict: 'AE',
                //
                scope: {},
                // We need to use the compile function so that we remove the
                // before it is included in the bootstraping algorithm
                compile: function compile(element) {
                    var inner = element.html(),
                        className = element[0].className;
                    //
                    element.html('');

                    return {
                        post: function (scope, element, attrs) {
                            scope.navbar2Content = inner;
                            navService.initScope(scope, attrs);

                            inner = $compile('<div data-nav-side-bar></div>')(scope);
                            element.replaceWith(inner.addClass(className));
                            //
                            windowResize(function () {
                                if (navService.maybeCollapse(scope.navbar))
                                    scope.$apply();
                            });
                        }
                    };
                }
            };
        }])
        //
        //  Directive for the navbar with sidebar (nivebar2 template)
        .directive('navSideBar', ['$compile', '$document', function ($compile, $document) {
            return {
                templateUrl: "nav/navbar2.tpl.html",

                restrict: 'A',

                link: function (scope, element, attrs) {
                    var navbar = scope.navbar;
                    element.addClass('navbar2-wrapper');
                    if (navbar && navbar.theme)
                        element.addClass('navbar-' + navbar.theme);
                    var inner = $($document[0].createElement('div')).addClass('navbar2-page')
                                    .append(scope.navbar2Content);
                    // compile
                    $compile(inner)(scope);
                    // and append
                    element.append(inner);
                    //
                    function resize() {
                        inner.attr('style', 'min-height: ' + windowHeight() + 'px');
                    }
                    //
                    windowResize(resize);
                    //
                    resize();
                }
            };
        }]);
