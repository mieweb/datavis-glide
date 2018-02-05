#!/usr/bin/env python3

from babel.dates import format_date
from babel.numbers import format_decimal
from datetime import date

import copy
import decimal
import json
import random
import re
import time
import sys

from jsoncomment import JsonComment

WORDS = open('/usr/share/dict/words').read().splitlines()
STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming']

def random_int(min=0, max=100, **opts):
    val = random.randint(min, max)
    if opts.get('output_type') == 'string':
        if 'format' in opts:
            return format_decimal(val, format=opts['format'])
        else:
            return str(val)
    else:
        return val

def random_float(min=0, max=1, **opts):
    val = random.uniform(min, max)
    if opts.get('output_type') == 'string':
        if 'format' in opts:
            return format_decimal(val, format=opts['format'])
        elif 'fixed' in opts:
            return str(decimal.Decimal(val).quantize(decimal.Decimal('1.' + ('0' * opts['fixed']))))
        else:
            return str(val)
    else:
        if 'fixed' in opts:
            return float(decimal.Decimal(val).quantize(decimal.Decimal('1.' + ('0' * opts['fixed']))))
        else:
            return val

def random_date(min='1900-01-01', max='2100-01-01', **opts):
    min = time.mktime(time.strptime(min, '%Y-%m-%d'))
    max = time.mktime(time.strptime(max, '%Y-%m-%d'))
    val = date.fromtimestamp(random_int(min, max))
    if 'format' in opts:
        return format_date(val, opts['format'])
    else:
        return str(val)

def word_dict():
    return WORDS[random.randint(0, len(WORDS))]

def state():
    return random.choice(STATES)

def repeat(times, val):
    return [process(copy.deepcopy(val)) for i in range(times)]

def process(node):
    env = { 'random_int': random_int,
            'random_float': random_float,
            'random_date': random_date,
            'repeat': repeat,
            'word_dict': word_dict,
            'choice': random.choice,
            'state': state }
    r = re.compile(r'\$<\s*(.*?)\s*>\$')
    def recur(node):
        if type(node) is dict:
            for key, val in node.items():
                node[key] = recur(val)
        elif type(node) is list:
            if len(node) == 2:
                match = r.fullmatch(node[0])
                if match:
                    env['VALUE'] = node[1]
                    return eval(match.group(1), env)
            for index, elt in enumerate(node):
                node[index] = recur(elt)
        elif type(node) is str:
            match = r.fullmatch(node)
            if match:
                return eval(match.group(1), env)
        return node
    return recur(node)

def parse(input, output):
    obj = JsonComment(json).load(input)
    process(obj)
    json.dump(obj, output, indent=2)

parse(sys.stdin, sys.stdout)
