#!/usr/bin/env python3.10

"""
WSGI configuration for My Shiftly Flask application on PythonAnywhere.

This file contains the WSGI callable as a module-level variable named ``application``.
For more information on this file, see
https://help.pythonanywhere.com/pages/Flask/
"""

import sys
import os
from pathlib import Path

# Add your project directory to the sys.path
path = '/home/yourusername/myshiftly'  # Замените yourusername на ваш username на PythonAnywhere
if path not in sys.path:
    sys.path.insert(0, path)

# Set environment variables for production
os.environ['FLASK_ENV'] = 'production'
os.environ['SECRET_KEY'] = 'your-production-secret-key-here'  # Замените на безопасный ключ

from app import app as application

if __name__ == "__main__":
    application.run()
