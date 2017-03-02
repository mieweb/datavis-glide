#!/usr/bin/env python

import json
import sys

import dicttoxml
import xml.dom.minidom

obj = json.load(sys.stdin)
xmlString = dicttoxml.dicttoxml(obj, attr_type = False)
dom = xml.dom.minidom.parseString(xmlString)
print(dom.toprettyxml())
