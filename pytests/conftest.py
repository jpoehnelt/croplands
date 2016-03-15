import pytest
from gfsad import create_app

@pytest.fixture(scope="function")
def app():
    return create_app('Testing')


