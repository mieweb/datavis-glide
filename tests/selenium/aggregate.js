const {assert} = require('chai');
const _ = require('lodash');
const {Promise} = require('bluebird');
const Grid = require('../lib/grid.js');
const {setupServer, sleep} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Aggregate', function() {
	setupServer();
	const logging = new LoggingPrefs();
	logging.setLevel(LoggingType.BROWSER, LoggingLevel.ALL);
	let driver;

	before(function () {
		driver = new Builder().forBrowser('chrome').setLoggingPrefs(logging).build();
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	describe('Group', function () {
		let grid;

		let intSums = [13235, 64040, 41184, 150370, 132879, 61900, 34549, 18485, 1494];
		let intAvgs = [3308.75, 5821.818181818182, 4576, 6537.826086956522, 5315.16, 3641.176470588235, 4935.571428571428, 6161.666666666667, 1494];
		let floatSums = [25256.941694891266, 73079.95424647664, 55761.26734643026, 142747.91542607444, 128604.97102449852, 98297.13477028029, 31771.824698853292, 20767.12095699954, 9327.40540844484];
		let floatAvgs = [6314.235423722816, 6643.6322042251495, 6195.696371825584, 6206.431105481497, 5144.1988409799405, 5782.184398251782, 4538.832099836184, 6922.37365233318, 9327.40540844484];
		let intMins = [18, 1471, 230, 2334, 1031, 540, 1020, 4260, 1494];
		let intMaxs = [8086, 9298, 9861, 9882, 9769, 9031, 9052, 7815, 1494];
		let floatMins = [2438.8648579944324, 823.6475089782774, 2385.9206702235865, 804.3777397068015, 140.40295994002554, 11.427050324968356, 2604.662611609202, 2756.0655789999596, 9327.40540844484];
		let floatMaxs = [9096.552813426433, 9826.871974900494, 9020.757338445388, 9665.097071339816, 9229.901315761948, 9637.421621192036, 6183.071597756641, 9961.582135696373, 9327.40540844484];

		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/default.html');
			grid = new Grid(driver);
			await grid.waitForIdle();
			await grid.addGroup('fruit');
			await grid.waitForIdle();
			await grid.setGroupMode('summary');
			await grid.waitForIdle();
		});

		after(async function () {
			await driver.executeScript('window.localStorage.clear()');
		});

		let ts = [{
			fun: 'count',
			tests: [{
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}]
		}, {
			fun: 'countDistinct',
			tests: [{
				fields: ['string1'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['int1'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['int4'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['int7'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['float1'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['float4'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['float7'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['date1'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['duration1'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['duration2'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['duration3'],
				results: ['3', '4', '3', '4', '4', '4', '2', '3', '1']
			}]
		}, {
			fun: 'values',
			tests: [{
				fields: ['string1'],
				results: ['unbetray, well-enacted, Hasinai, moanfully']
			}, {
				fields: ['int1'],
				results: ['3578, 1553, 18, 8086']
			}, {
				fields: ['int4'],
				results: ['3578, 1553, 18, 8086']
			}, {
				fields: ['int7'],
				results: ['3578, 1553, 18, 8086']
			}, {
				fields: ['float1'],
				results: ['5046.363871318085, 9096.552813426433, 8675.160152152315, 2438.8648579944324']
			}, {
				fields: ['float4'],
				// results: ['5046.363871318085, 9096.552813426433, 8675.160152152315, 2438.8648579944324']
				results: ['5046.363871318085, 9096.552813426431, 8675.160152152315, 2438.8648579944324']
			}, {
				fields: ['float7'],
				results: ['5046.363871318085, 9096.552813426433, 8675.160152152315, 2438.8648579944324']
			}, {
				fields: ['date1'],
				results: ['March 13, 2070, September 15, 1913, July 25, 1960, May 21, 1952']
			}]
		}, {
			fun: 'valuesWithCounts',
			tests: [{
				fields: ['duration1'],
				results: [
					'64y 97d 18h 14m 15s 822t 990u (1), 610y 197d 10h 36m 15s 297t 188u (1), 759y 40d 10h 47m 2s 557t 287u (1), 138y 122d 15h 22m 39s 294t 689u (1)',
					'870y 350d 10h 30m 35s 103t 362u (1), 565y 244d 14h 55m 33s 266t 63u (1), 193y 95d 1h 39m 42s 266t 487u (1), 534y 120d 6h 57m 43s 603t 845u (1), 542y 128d 3h 38m 58s 452t 681u (1), 428y 339d 22h 2m 10s 456t 65u (1), 929y 287d 19h 48m 0s 905t 39u (1), 226y 31d 12h 0m 6s 403t 569u (1), 555y 312d 7h 0m 21s 722t 985u (1), 824y 265d 19h 4m 47s 436t 927u (1), 772y 105d 9h 34m 57s 612t 427u (1)',
					'945y 19d 2h 57m 44s 945t 849u (1), 149y 357d 7h 2m 52s 587t 649u (1), 179y 6d 15h 43m 26s 921t 582u (1), 581y 212d 1h 25m 55s 718t 581u (1), 265y 359d 5h 28m 33s 906t 498u (1), 742y 66d 0h 25m 43s 427t 323u (1), 664y 101d 9h 17m 44s 186t 102u (1), 182y 106d 12h 37m 18s 9t 141u (1), 853y 255d 15h 40m 42s 895t 206u (1)',
					'864y 197d 13h 2m 16s 988t 523u (1), 97y 316d 8h 58m 34s 722t 829u (1), 824y 280d 0h 5m 46s 860t 408u (1), 727y 342d 20h 0m 39s 505t 847u (1), 888y 170d 7h 46m 20s 720t 891u (1), 650y 96d 19h 53m 36s 122t 400u (1), 358y 223d 5h 3m 32s 478t 40u (1), 506y 166d 9h 53m 29s 51t 828u (1), 487y 203d 20h 5m 1s 281t 935u (1), 463y 59d 8h 8m 41s 533t 836u (1), 871y 9d 1h 2m 13s 697t 265u (1), 154y 138d 10h 21m 50s 376t 735u (1), 300y 58d 15h 46m 15s 956t 49u (1), 315y 91d 16h 46m 4s 309t 412u (1), 831y 175d 3h 30m 7s 716t 509u (1), 654y 44d 2h 51m 5s 202t 767u (1), 531y 148d 14h 58m 31s 807t 598u (1), 731y 347d 6h 27m 5s 377t 225u (1), 267y 299d 5h 27m 12s 367t 117u (1), 693y 103d 3h 31m 25s 262t 212u (1), 656y 21d 6h 39m 9s 107t 202u (1), 433y 266d 15h 43m 58s 909t 330u (1), 542y 257d 1h 36m 5s 694t 813u (1)',
					'497y 207d 9h 30m 22s 597t 913u (1), 444y 161d 19h 40m 58s 209t 989u (1), 145y 278d 14h 5m 5s 327t 896u (1), 553y 349d 12h 53m 45s 537t 282u (1), 498y 300d 20h 21m 54s 194t 248u (1), 16y 138d 3h 45m 14s 380t 813u (1), 174y 170d 13h 52m 3s 103t 801u (1), 931y 273d 19h 43m 4s 27t 127u (1), 93y 189d 3h 2m 38s 22t 199u (1), 984y 94d 22h 7m 30s 215t 744u (1), 610y 51d 22h 25m 12s 266t 367u (1), 926y 240d 18h 10m 44s 688t 208u (1), 317y 198d 23h 26m 53s 666t 82u (1), 1y 304d 6h 44m 21s 163t 245u (1), 228y 326d 14h 24m 45s 896t 689u (1), 842y 212d 6h 35m 40s 85t 857u (1), 666y 330d 11h 7m 55s 158t 285u (1), 866y 359d 19h 41m 31s 729t 659u (1), 855y 168d 9h 26m 6s 101t 574u (1), 436y 19d 9h 21m 47s 703t 915u (1), 159y 85d 20h 36m 24s 825t 997u (1), 65y 359d 0h 57m 33s 462t 770u (1), 764y 162d 10h 2m 33s 151t 895u (1), 845y 246d 12h 38m 37s 239t 871u (1), 885y 10d 21h 56m 0s 758t 186u (1)',
					'929y 111d 16h 8m 18s 143t 773u (1), 520y 250d 3h 19m 35s 298t 723u (1), 986y 308d 17h 37m 18s 455t 93u (1), 70y 45d 21h 48m 8s 897t 153u (1), 972y 214d 18h 17m 28s 504t 676u (1), 656y 358d 11h 5m 20s 627t 118u (1), 895y 260d 9h 41m 22s 397t 857u (1), 673y 128d 4h 35m 44s 12t 468u (1), 691y 270d 19h 6m 12s 121t 622u (1), 571y 161d 11h 36m 58s 869t 43u (1), 924y 234d 20h 27m 23s 892t 550u (1), 95y 173d 19h 2m 2s 276t 167u (1), 153y 298d 9h 23m 25s 561t 132u (1), 469y 193d 11h 34m 52s 154t 107u (1), 263y 308d 4h 53m 24s 596t 301u (1), 735y 361d 15h 4m 51s 86t 528u (1), 15y 229d 10h 55m 10s 819t 152u (1)',
					'616y 75d 9h 6m 46s 75t 920u (1), 127y 280d 10h 52m 59s 553t 208u (1), 819y 31d 21h 1m 34s 435t 635u (1), 989y 29d 21h 10m 54s 165t 350u (1), 367y 302d 20h 54m 39s 135t 732u (1), 930y 246d 15h 21m 53s 817t 999u (1), 889y 20d 2h 14m 8s 41t 307u (1)',
					'103y 133d 2h 14m 4s 662t 308u (1), 610y 249d 4h 36m 25s 653t 696u (1), 889y 335d 14h 23m 32s 391t 922u (1)',
					'3y 109d 0h 45m 48s 2t 842u (1)',
				]}, {
				fields: ['duration2'],
				results: [
					'18:14:15 (1), 10:36:15 (1), 10:47:02 (1), 15:22:39 (1)',
					'10:30:35 (1), 14:55:33 (1), 01:39:42 (1), 06:57:43 (1), 03:38:58 (1), 22:02:10 (1), 19:48:00 (1), 12:00:06 (1), 07:00:21 (1), 19:04:47 (1), 09:34:57 (1)',
					'02:57:44 (1), 07:02:52 (1), 15:43:26 (1), 01:25:55 (1), 05:28:33 (1), 00:25:43 (1), 09:17:44 (1), 12:37:18 (1), 15:40:42 (1)',
					'13:02:16 (1), 08:58:34 (1), 00:05:46 (1), 20:00:39 (1), 07:46:20 (1), 19:53:36 (1), 05:03:32 (1), 09:53:29 (1), 20:05:01 (1), 08:08:41 (1), 01:02:13 (1), 10:21:50 (1), 15:46:15 (1), 16:46:04 (1), 03:30:07 (1), 02:51:05 (1), 14:58:31 (1), 06:27:05 (1), 05:27:12 (1), 03:31:25 (1), 06:39:09 (1), 15:43:58 (1), 01:36:05 (1)',
					'09:30:22 (1), 19:40:58 (1), 14:05:05 (1), 12:53:45 (1), 20:21:54 (1), 03:45:14 (1), 13:52:03 (1), 19:43:04 (1), 03:02:38 (1), 22:07:30 (1), 22:25:12 (1), 18:10:44 (1), 23:26:53 (1), 06:44:21 (1), 14:24:45 (1), 06:35:40 (1), 11:07:55 (1), 19:41:31 (1), 09:26:06 (1), 09:21:47 (1), 20:36:24 (1), 00:57:33 (1), 10:02:33 (1), 12:38:37 (1), 21:56:00 (1)',
					'16:08:18 (1), 03:19:35 (1), 17:37:18 (1), 21:48:08 (1), 18:17:28 (1), 11:05:20 (1), 09:41:22 (1), 04:35:44 (1), 19:06:12 (1), 11:36:58 (1), 20:27:23 (1), 19:02:02 (1), 09:23:25 (1), 11:34:52 (1), 04:53:24 (1), 15:04:51 (1), 10:55:10 (1)',
					'09:06:46 (1), 10:52:59 (1), 21:01:34 (1), 21:10:54 (1), 20:54:39 (1), 15:21:53 (1), 02:14:08 (1)',
					'02:14:04 (1), 04:36:25 (1), 14:23:32 (1)',
					'00:45:48 (1)',
				]}, {
				fields: ['duration3'],
				results: [
					'0 hours, 45 minutes (1), 1 hours, 0 minutes (2), 0 hours, 30 minutes (1)',
					'0 hours, 30 minutes (3), 1 hours, 0 minutes (4), 0 hours, 45 minutes (3), 0 hours, 15 minutes (1)',
					'1 hours, 0 minutes (2), 0 hours, 45 minutes (5), 0 hours, 30 minutes (2)',
					'1 hours, 0 minutes (7), 0 hours, 30 minutes (5), 0 hours, 45 minutes (10), 0 hours, 15 minutes (1)',
					'0 hours, 45 minutes (8), 0 hours, 30 minutes (10), 0 hours, 15 minutes (3), 1 hours, 0 minutes (4)',
					'0 hours, 30 minutes (4), 0 hours, 45 minutes (8), 1 hours, 0 minutes (3), 0 hours, 15 minutes (2)',
					'0 hours, 45 minutes (3), 0 hours, 30 minutes (4)',
					'0 hours, 45 minutes (1), 0 hours, 30 minutes (1), 1 hours, 0 minutes (1)',
					'1 hours, 0 minutes (1)',
				]
			}]
		}, {
			fun: 'sum',
			tests: [{
				fields: ['int1'],
				resultType: 'number',
				results: intSums
			}, {
				fields: ['int2'],
				resultType: 'number',
				results: intSums
			}, {
				fields: ['int3'],
				resultType: 'number',
				results: intSums
			}, {
				fields: ['int4'],
				resultType: 'number',
				results: intSums
			}, {
				fields: ['int5'],
				resultType: 'number',
				results: intSums
			}, {
				fields: ['int6'],
				resultType: 'number',
				results: intSums
			}, {
				fields: ['int7'],
				resultType: 'number',
				results: intSums
			}, {
				fields: ['int8'],
				resultType: 'number',
				results: intSums
			}, {
				fields: ['int9'],
				resultType: 'number',
				results: intSums
			}, {
				fields: ['float1'],
				resultType: 'number',
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float2'],
				resultType: 'number',
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float3'],
				resultType: 'number',
				match: 'approximately',
				assertArgs: [0.01], // decreasing precision because inputs have three decimal places
				results: floatSums
			}, {
				fields: ['float4'],
				resultType: 'number',
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float5'],
				resultType: 'number',
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float6'],
				resultType: 'number',
				match: 'approximately',
				assertArgs: [0.01], // decreasing precision because inputs have three decimal places
				results: floatSums
			}, {
				fields: ['float7'],
				resultType: 'number',
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float8'],
				resultType: 'number',
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float9'],
				resultType: 'number',
				match: 'approximately',
				assertArgs: [0.01], // decreasing precision because inputs have three decimal places
				results: floatSums
			}, {
				fields: ['duration1'],
				results: [
					'1572y 93d 7h 0m 12s 972t 154u',
					'6444y 91d 7h 12m 57s 229t 450u',
					'4564y 23d 22h 40m 2s 597t 931u',
					'12853y 2d 1h 39m 5s 50t 771u',
					'12814y 132d 10h 38m 43s 515t 612u',
					'9627y 260d 8h 37m 37s 713t 463u',
					'4739y 257d 4h 42m 55s 225t 151u',
					'1603y 352d 21h 14m 2s 707t 926u',
					'3y 109d 0h 45m 48s 2t 842u',
				]
			}, {
				fields: ['duration2'],
				results: [
					'2 days 07:00:11',
					'5 days 07:12:52',
					'2 days 22:39:57',
					'9 days 01:38:53',
					'14 days 10:38:34',
					'9 days 08:37:30',
					'4 days 04:42:53',
					'21:14:01',
					'00:45:48',
				]
			}, {
				fields: ['duration3'],
				results: [
					'3 hours, 15 minutes',
					'8 hours, 0 minutes',
					'6 hours, 45 minutes',
					'17 hours, 15 minutes',
					'15 hours, 45 minutes',
					'11 hours, 30 minutes',
					'4 hours, 15 minutes',
					'2 hours, 15 minutes',
					'1 hours, 0 minutes',
				]
			}]
		}, {
			fun: 'average',
			resultType: 'number',
			match: 'approximately',
			tests: [
				{ fields: ['int1'], results: intAvgs },
				{ fields: ['int2'], results: intAvgs },
				{ fields: ['int3'], results: intAvgs },
				{ fields: ['int4'], results: intAvgs },
				{ fields: ['int5'], results: intAvgs },
				{ fields: ['int6'], results: intAvgs },
				{ fields: ['int7'], results: intAvgs },
				{ fields: ['int8'], results: intAvgs },
				{ fields: ['int9'], results: intAvgs },
				{ fields: ['float1'], results: floatAvgs },
				{ fields: ['float2'], results: floatAvgs },
				{ fields: ['float3'], results: floatAvgs },
				{ fields: ['float4'], results: floatAvgs },
				{ fields: ['float5'], results: floatAvgs },
				{ fields: ['float6'], results: floatAvgs },
				{ fields: ['float7'], results: floatAvgs },
				{ fields: ['float8'], results: floatAvgs },
				{ fields: ['float9'], results: floatAvgs }
			]
		}, {
			fun: 'min',
			tests: [
				{ fields: ['string1'], results: ['Hasinai', 'apiarists', 'embracer', 'backtracker', 'bordrag', 'agitated', 'abidal', 'biali', 'malpighian'] },
				{ fields: ['int1'], results: intMins, resultType: 'number' },
				{ fields: ['int2'], results: intMins, resultType: 'number' },
				{ fields: ['int3'], results: intMins, resultType: 'number' },
				{ fields: ['int4'], results: intMins, resultType: 'number' },
				{ fields: ['int5'], results: intMins, resultType: 'number' },
				{ fields: ['int6'], results: intMins, resultType: 'number' },
				{ fields: ['int7'], results: intMins, resultType: 'number' },
				{ fields: ['int8'], results: intMins, resultType: 'number' },
				{ fields: ['int9'], results: intMins, resultType: 'number' },
				{ fields: ['float1'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float2'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float3'], results: floatMins, resultType: 'number', match: 'approximately', assertArgs: [0.01] },
				{ fields: ['float4'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float5'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float6'], results: floatMins, resultType: 'number', match: 'approximately', assertArgs: [0.01] },
				{ fields: ['float7'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float8'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float9'], results: floatMins, resultType: 'number', match: 'approximately', assertArgs: [0.01] },
				{ fields: ['date1'], results: ['September 15, 1913', 'November 30, 1901', 'December 3, 1964', 'December 12, 1902', 'March 19, 1911', 'January 29, 1933', 'April 5, 1945', 'May 18, 1935', 'May 10, 2089'] },
				{ fields: ['date2'], results: ['September 15, 1913', 'November 30, 1901', 'December 3, 1964', 'December 12, 1902', 'March 19, 1911', 'January 29, 1933', 'April 5, 1945', 'May 18, 1935', 'May 10, 2089'] },
				{ fields: ['date3'], results: ['September 15, 1913', 'November 30, 1901', 'December 3, 1964', 'December 12, 1902', 'March 19, 1911', 'January 29, 1933', 'April 5, 1945', 'May 18, 1935', 'May 10, 2089'] },
				{ fields: ['duration1'], results: [
					'64y 97d 18h 14m 15s 822t 990u',
					'193y 95d 1h 39m 42s 266t 487u',
					'149y 357d 7h 2m 52s 587t 649u',
					'97y 316d 8h 58m 34s 722t 829u',
					'1y 304d 6h 44m 21s 163t 245u',
					'15y 229d 10h 55m 10s 819t 152u',
					'127y 280d 10h 52m 59s 553t 208u',
					'103y 133d 2h 14m 4s 662t 308u',
					'3y 109d 0h 45m 48s 2t 842u',
				]}, {
					fields: ['duration2'], results: [
						'10:36:15',
						'01:39:42',
						'00:25:43',
						'00:05:46',
						'00:57:33',
						'03:19:35',
						'02:14:08',
						'02:14:04',
						'00:45:48',
					]
				}, {
					fields: ['duration3'], results: [
						'0 hours, 30 minutes',
						'0 hours, 15 minutes',
						'0 hours, 30 minutes',
						'0 hours, 15 minutes',
						'0 hours, 15 minutes',
						'0 hours, 15 minutes',
						'0 hours, 30 minutes',
						'0 hours, 30 minutes',
						'1 hours, 0 minutes',
					]
				}
			]
		}, {
			fun: 'max',
			tests: [
				{ fields: ['string1'], results: ['well-enacted', 'zigzagged', 'Wilsall', 'wegotism', 'yellow-tailed', 'unwarier', 'solifidian', 'wolfskin', 'malpighian'] },
				{ fields: ['int1'], results: intMaxs, resultType: 'number' },
				{ fields: ['int2'], results: intMaxs, resultType: 'number' },
				{ fields: ['int3'], results: intMaxs, resultType: 'number' },
				{ fields: ['int4'], results: intMaxs, resultType: 'number' },
				{ fields: ['int5'], results: intMaxs, resultType: 'number' },
				{ fields: ['int6'], results: intMaxs, resultType: 'number' },
				{ fields: ['int7'], results: intMaxs, resultType: 'number' },
				{ fields: ['int8'], results: intMaxs, resultType: 'number' },
				{ fields: ['int9'], results: intMaxs, resultType: 'number' },
				{ fields: ['float1'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float2'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float3'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float4'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float5'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float6'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float7'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float8'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float9'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['date1'], results: ['March 13, 2070', 'May 20, 2077', 'April 11, 2061', 'June 24, 2086', 'May 12, 2080', 'May 19, 2090', 'January 10, 2094', 'January 19, 2047', 'May 10, 2089'] },
				{ fields: ['date2'], results: ['March 13, 2070', 'May 20, 2077', 'April 11, 2061', 'June 24, 2086', 'May 12, 2080', 'May 19, 2090', 'January 10, 2094', 'January 19, 2047', 'May 10, 2089'] },
				{ fields: ['date3'], results: ['March 13, 2070', 'May 20, 2077', 'April 11, 2061', 'June 24, 2086', 'May 12, 2080', 'May 19, 2090', 'January 10, 2094', 'January 19, 2047', 'May 10, 2089'] },
				{
					fields: ['duration1'],
					results: [
						'759y 40d 10h 47m 2s 557t 287u',
						'929y 287d 19h 48m 0s 905t 39u',
						'945y 19d 2h 57m 44s 945t 849u',
						'888y 170d 7h 46m 20s 720t 891u',
						'984y 94d 22h 7m 30s 215t 744u',
						'986y 308d 17h 37m 18s 455t 93u',
						'989y 29d 21h 10m 54s 165t 350u',
						'889y 335d 14h 23m 32s 391t 922u',
						'3y 109d 0h 45m 48s 2t 842u',
					]
				}, {
					fields: ['duration2'],
					results: [
						'18:14:15',
						'22:02:10',
						'15:43:26',
						'20:05:01',
						'23:26:53',
						'21:48:08',
						'21:10:54',
						'14:23:32',
						'00:45:48',
					]
				}, {
					fields: ['duration3'],
					results: [
						'1 hours, 0 minutes',
						'1 hours, 0 minutes',
						'1 hours, 0 minutes',
						'1 hours, 0 minutes',
						'1 hours, 0 minutes',
						'1 hours, 0 minutes',
						'0 hours, 45 minutes',
						'1 hours, 0 minutes',
						'1 hours, 0 minutes',
					]
				}
			]
		}];

		_.each(ts, function ({fun, resultType = 'string', match = 'equal', tests}) {
			let outerMatch = match;
			let outerResultType = resultType;
			describe(fun, function () {
				before(async function () {
					await grid.clearAggregates();
					await grid.waitForIdle();
					await grid.addAggregate(fun);
					await grid.waitForIdle();
				});
				_.each(tests, function ({fields, resultType = outerResultType, match = outerMatch, message, assertArgs = [], results}) {
					if (fields != null) {
						it(JSON.stringify(fields), async function () {
							await Promise.all(_.map(fields, async function (field) {
								await grid.setAggregate(fun, field);
								await grid.waitForIdle();
							}));
							return Promise.all(_.map(results, async function (r, ri) {
								let actual = await grid.getGroupCell(ri, 0);
								let expected = r;
								if (resultType === 'number') {
									actual = +actual;
									expected = +expected;
									if (assertArgs.length === 0) {
										assertArgs = [0.001];
									}
								}
								let args = [actual, expected].concat(assertArgs, message);
								//console.log(JSON.stringify(args));
								assert[match].apply(this, args);
							}));
						});
					}
					else {
						it('no fields', async function () {
							return Promise.all(_.map(results, async function (r, ri) {
								assert.equal(await grid.getGroupCell(ri, 0), r);
							}));
						});
					}
				});
			});
		});
	});

	describe('pivot', function () {
		let grid;

		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/default.html');
			grid = new Grid(driver);
			await grid.waitForIdle();

			await grid.addGroup('country');
			await grid.waitForIdle();

			await grid.addPivot('fruit');
			await grid.waitForIdle();
		});

		after(async function () {
			await driver.executeScript('window.localStorage.clear()');
		});

		//it('has correct group aggregates', async function () { });

		it('has correct pivot aggregates', async function () {
			await Promise.each([
				[['Banana'], 4],
				[['Blueberry'], 11],
				[['Cherry'], 9],
				[['Grape'], 23],
				[['Kiwi'], 25],
				[['Mango'], 17],
				[['Orange'], 7],
				[['Pineapple'], 3],
				[['Strawberry'], 1],
			], async (t) => {
				const [cv, res] = t;
				assert.equal(await grid.getAggregateResult('pivot', null, cv, 0), res);
			});
		});

		//it('has correct cell aggregates', async function () { });
		//it('has correct all aggregates', async function () { });
	});
});
