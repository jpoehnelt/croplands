from setuptools import setup

import sys

from setuptools import setup, find_packages
from setuptools.command.test import test as TestCommand


def get_requirements(suffix=''):
    with open('requirements%s.txt' % suffix) as f:
        rv = f.read().splitlines()
    return rv


def get_long_description():
    with open('README.rst') as f:
        rv = f.read()
    return rv


class PyTest(TestCommand):
    def finalize_options(self):

        TestCommand.finalize_options(self)
        self.test_args = [
            '-rs',
            '-vvv',
            '--cov', 'croplands_api',
            '--cov-report', 'term-missing',
            '--pep8',
            '--flakes',
            'tests'
        ]
        self.test_suite = True

    def run_tests(self):
        import pytest

        errno = pytest.main(self.test_args)
        sys.exit(errno)


setup(
    name='Croplands-API',
    version='0.3.0',
    url='https://github.com/justinwp/gfsad',
    download_url='https://github.com/justinwp/gfsad/tarball/0.2.0',
    license='MIT',
    author='Justin Poehnelt',
    author_email='Justin.Poehnelt@gmail.com',
    description='API for Global Croplands Website and Mobile App',
    long_description=__doc__,
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    platforms='any',
    install_requires=get_requirements(),
    tests_require=get_requirements('-test'),
    cmdclass={'test': PyTest},
    classifiers=[
        "Development Status :: 4 - Beta",
        'Environment :: Web Environment',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Topic :: Internet :: WWW/HTTP :: Dynamic Content',
        'Topic :: Software Development :: Libraries :: Python Modules'
    ]
)
