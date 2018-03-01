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
import inspect

from jsoncomment import JsonComment

WORDS = open('/usr/share/dict/words').read().splitlines()
STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming']
RANDOMS = {}
RANDOM_SEED = { 'seed': None }

def init_random(name=None):
    if name == None:
        name = inspect.stack()[1].frame.f_code.co_name
    if name not in RANDOMS:
        RANDOMS[name] = random.Random()
        if RANDOM_SEED['seed'] != None:
            RANDOMS[name].seed(RANDOM_SEED['seed'])
    return RANDOMS[name]

def clamp(val, low, high):
    return max(min(val, high), low)

def random_int(name='random_int', min=0, max=100, **opts):
    r = init_random(name)
    val = r.randint(min, max)
    if opts.get('output_type') == 'string':
        if 'format' in opts:
            return format_decimal(val, format=opts['format'])
        else:
            return str(val)
    else:
        return val

def random_float(name='random_float', min=0, max=1, **opts):
    r = init_random(name)
    val = r.uniform(min, max)
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

def random_date(name='random_date', min='1900-01-01', max='2100-01-01', **opts):
    r = init_random(name)
    min = time.mktime(time.strptime(min, '%Y-%m-%d'))
    max = time.mktime(time.strptime(max, '%Y-%m-%d'))
    val = date.fromtimestamp(r.randint(min, max))
    if 'format' in opts:
        return format_date(val, opts['format'])
    else:
        return str(val)

def random_element(name, set, dist='uniform'):
    r = init_random(name)
    if dist == 'triangular':
        i = round(r.triangular(0, len(set) - 1))
    elif dist == 'normal':
        mu = len(set)/2.0 - 0.5
        sigma = len(set)/6.0 # three std dev on each side, close enough
        i = clamp(round(r.normalvariate(mu, sigma)), 0, len(set) - 1)
    else:
        i = round(r.uniform(0, len(set) - 1))
    return set[i]

def word_dict(name='word_dict'):
    r = init_random(name)
    return WORDS[r.randint(0, len(WORDS))]

def state(name='state'):
    r = init_random(name)
    return r.choice(STATES)

def random_seed(n):
    RANDOM_SEED['seed'] = n

def repeat(times, val):
    result = []
    for i in range(times):
        if i % 100 == 0:
            if i > 0: print(' ... ', end='', file=sys.stderr)
            print(i, end='', file=sys.stderr, flush=True)
        result.append(process(copy.deepcopy(val)))
    print(' ...', i, '[DONE]', file=sys.stderr, flush=True)
    return result

CYCLE = {}
def cycle(name, lst):
    if name in CYCLE:
        c = CYCLE[name]
        c['index'] += 1
        if c['index'] >= len(c['list']):
            c['index'] = 0
        return c['list'][c['index']]
    else:
        CYCLE[name] = { 'index': 0, 'list': lst }
        return lst[0]

def process(node):
    env = { 'random_int': random_int,
            'random_float': random_float,
            'random_date': random_date,
            'random_element': random_element,
            'repeat': repeat,
            'word_dict': word_dict,
            'choice': random.choice,
            'state': state,
            'cycle': cycle,
            'RANDOM_SEED': RANDOM_SEED }
    r = re.compile(r'\$<\s*(.*?)\s*>\$')
    def recur(node):
        if type(node) is dict:
            for key, val in node.items():
                if val == None:
                    match = r.fullmatch(key)
                    if match:
                        eval(match.group(1))
                        del node[key]
                        return recur(node)
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
