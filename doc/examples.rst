********
Examples
********

Data Generation
===============

http://www.json-generator.com/

::

  {
    data: [
      '{{repeat(50)}}',
      {
        first_name: '{{firstName()}}',
        last_name: '{{surname()}}',
        random_date: '{{date(null, null, "YYYY-MM-dd")}}',
        random_int: '{{integer(0, 100)}}',
        random_float: '{{floating(0, 100, 3)}}',
        random_money: '{{floating(0, 10000, null, "\'$0,0.0\'")}}',
        state: '{{state()}}'
      }
    ],
      typeInfo: {
        byName: {
          first_name: 'string',
          last_name: 'string',
          random_date: 'date',
          random_int: 'number',
          random_float: 'number',
          random_money: 'string',
          state: 'string'
        },
          byIndex: ['string', 'string', 'date', 'string']
      }
  }
