/*global module:false*/
module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
        // Metadata.
        pkg: grunt.file.readJSON('package.json'),
        banner: '/*! <%= pkg.title || pkg.name %> - ' +
            '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
            '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
            '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
            '*/\n',
        // Task configuration.
        concat: {
            options: {
                separator: ';\n'
            },
            dist: {
                src: ['gfsad/static/js/lib/*.js', 'gfsad/static/js/utilities/*.js', 'gfsad/static/js/app/config.js', 'gfsad/static/js/services/*.js', 'gfsad/static/js/filters/*.js', 'gfsad/static/js/controllers/*.js', 'gfsad/static/js/directives/*.js'  ],
                dest: 'gfsad/static/js/app.<%= pkg.version %>.js'
            }
        },
        uglify: {
            options: {
                mangle: true,
                banner: '<%= banner %>'
            },
            dist: {
                src: '<%= concat.dist.dest %>',
                dest: 'gfsad/static/js/app.<%= pkg.version %>.min.js'
            }
        },
        less: {
            development: {
                options: {
                },
                files: {
                    // target.css file: source.less file
                    "gfsad/static/css/main.<%= pkg.version %>.css": "gfsad/static/css/less/bootstrap.less"
                }
            },
            production: {
                options: {
                    cleancss: true,
                    compress: true,
                    yuicompress: true,
                    optimization: 2
                },
                files: {
                    // target.css file: source.less file
                    "gfsad/static/css/main.<%= pkg.version %>.min.css": "gfsad/static/css/less/bootstrap.less"
                }
            }
        },

        watch: {
            js: {
                files: ['<%= concat.dist.src %>', 'Gruntfile.js', 'package.json'],
                tasks: ['concat', 'uglify']
            },
            less: {
                files: ['gfsad/static/css/less/*', 'gfsad/static/css/less/mixins/*', 'Gruntfile.js', 'package.json'],
                tasks: ['less']
            }

        },
        sloc: {
            'source': {
                files: {
                    './': ['gfsad/static/js/app/*.js', 'gfsad/static/js/controllers/*.js', 'gfsad/static/js/directives/*.js', 'gfsad/static/js/filters/*.js', 'gfsad/static/js/services/*.js', 'gfsad/static/partials/*.html', 'gfsad/models/*.py', 'gfsad/templates/*.html', 'gfsad/views/*.py', 'gfsad/models/*.py', 'tests/*.py', 'gfsad/static/css/app_v2.css']
                }
            }
        }
    });
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-sloc');

    // Default task.
    grunt.registerTask('default', ['concat', 'uglify', 'less', 'sloc']);

};