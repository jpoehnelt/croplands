from croplands_api.models import db
from croplands_api.models.base import BaseModel
from sqlalchemy.exc import IntegrityError
from croplands_api import jwt
import time
import uuid
from croplands_api.exceptions import UserError
from passlib.context import CryptContext
from datetime import datetime
import random
from sqlalchemy import event
import hashlib


_pwd_context = CryptContext(schemes=["sha256_crypt", "md5_crypt", "des_crypt"])


class User(BaseModel):
    """
    The base User object.

    """

    STATUS_ENABLED = 'ENABLED'
    STATUS_UNVERIFIED = 'UNVERIFIED'
    STATUS_DISABLED = 'DISABLED'

    ROLES = ['banned', 'registered', 'partner', 'mapping', 'validation', 'admin']
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    date_created = db.Column(db.DateTime, default=db.func.now())
    last_login = db.Column(db.DateTime, default=db.func.now())

    email = db.Column(db.String, unique=True)
    first = db.Column(db.String, nullable=False)
    last = db.Column(db.String, nullable=False)
    organization = db.Column(db.String)
    country = db.Column(db.String)

    password = db.Column(db.String, nullable=False)
    attempts = db.Column(db.Integer, default=0)

    status = db.Column(db.String, default=STATUS_UNVERIFIED)
    email_verification_token = db.Column(db.String)
    role = db.Column(db.String, default='registered')

    score = db.Column(db.Integer, default=0)

    def __init__(self, email, password, first, last, role="registered", organization=None,
                 country=None, **kwargs):
        self.email = email.lower()
        self.first = first
        self.last = last
        self.role = role
        self.organization = organization
        self.country = country
        self.email_verification_token = str(uuid.uuid4())
        # hash password
        self.password = _pwd_context.encrypt(password)
        self.date_created = datetime.utcnow()

        super(User, self).__init__()



    def __repr__(self):
        return u'User <"%s" (%s)>' % (self.email, self.id)

    def get_id(self):
        """
        Return the unique user identifier (in our case, the Stormpath resource
        href).
        """
        return self.id

    def is_active(self):
        """
        A user account is active if, and only if, their account status is
        'ENABLED'.
        """
        return self.status == 'ENABLED'

    def change_password(self, password):
        self.password = _pwd_context.encrypt(password)
        # change verification token for password change
        self.email_verification_token = str(uuid.uuid4())
        # save the user
        db.session.commit()

    @property
    def get_public(self):
        return {
            'id': self.id,
            'first': self.first,
            'last': self.last,
            'organization': self.organization,
            'country': self.country,
            'role': self.role
        }

    @classmethod
    def create(self, email, password, first, last, **kwargs):
        try:
            user = User(email, password, first, last, **kwargs)
            db.session.add(user)
            db.session.commit()
        except IntegrityError as e:
            raise UserError(description='Account with that email already exists.', status_code=409)
        return user

    @classmethod
    @jwt.authentication_handler
    def from_login(self, email, password):
        user = User.query.filter_by(email=email.lower()).first()

        time.sleep(random.randint(0, 1) / 100)

        if user is None:
            password_hash = _pwd_context.encrypt('fake password here')
        else:
            # get hashed password
            user.attempts += 1
            db.session.commit()

            password_hash = user.password

            # timing protection and prevents unknown hash
            _pwd_context.encrypt('fake password here')

        if _pwd_context.verify(password, password_hash):
            # reset login attempt counter
            user.attempts = 0
            user.last_login = datetime.utcnow()
            db.session.commit()

            # return the user
            return user

        raise UserError(description='Invalid email and/or password.', status_code=401,
                        error="Unauthorized")

    @staticmethod
    def from_email(email):
        """
        Returns a User instance from email address.
        :param email:
        :return: User
        """
        user = User.query.filter_by(email=email.lower()).first()
        if user is None:
            print 'User not found for: %s' % email
        return user


    @staticmethod
    @jwt.user_handler
    def from_token_payload(payload):
        """
        Returns User instance from token.
        :param payload:
        :return: User
        """
        return User.from_email(payload['email'])

    @jwt.payload_handler
    def make_token_payload(self, expires=int(time.time())):
        """
        Bundles data for token.
        :param expires:
        :return: dict
        """

        return {
            'id': self.id,
            'first': self.first,
            'last': self.last,
            'email': self.email,
            'expires': expires,
            'role': self.role
        }


    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def verify(self, token):
        """
        Changes user status from 'UNVERIFIED' to 'ENABLED' if token matches
        :param token:
        :return:
        """
        if token == self.email_verification_token:
            self.status = 'ENABLED'
            db.session.commit()
            return True
        return False

    def change_role(self, role):
        assert (role in User.ROLES)
        self.role = role
        db.session.commit()

