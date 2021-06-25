import pTimes from 'p-times'
import { PrismaClient as PrismaClientNapi } from './prisma/client'
import { PrismaClient as PrismaClientNoNapi } from './prisma/client-nonapi'
import { performance } from 'perf_hooks'

const prettyMs = require('pretty-ms')
const Benchmark = require('benchmark')
const measured = require('measured-core')
var asciichart = require('asciichart')
const c = require('chalk')

export function sampleData(oldArr, width) {
  const factor = Math.round(oldArr.length / width)
  return oldArr.filter(function (value, index, Arr) {
    return index % factor == 0
  })
}

export async function runTest(useNapi) {
  const { prisma } = await setup(useNapi)

  const concurrency = 1
  const warmupCount = concurrency*2
  const testCount = 100

  const data = []
  const histogram = new measured.Histogram()

  // warmup
  await pTimes(
    warmupCount,
    async () => {
      await test(prisma)
    },
    { concurrency: concurrency }
  )

  // test
  await pTimes(
    testCount,
    async () => {
      const start = now()
      await test(prisma)
      const duration = now() - start
      histogram.update(duration)
      data.push(duration)
    },
    { concurrency: concurrency },
  )
  const results = histogram.toJSON()

  await prisma.$disconnect()
  return { results, data }
}

export function setup(useNapi) {
  const PrismaClient = useNapi ? PrismaClientNapi : PrismaClientNoNapi
  const prisma = new PrismaClient()
  return { prisma }
}

export async function test(prisma) {

  // findFirst
  const results = prisma.track.findFirst({ where: { TrackId: 1 } })

  // // Large input, large result
  // const selection = Array.from({length: 1000}, () => Math.floor(Math.random() * 4000))
  // const results = await prisma.track.findFirst({ where: { TrackId: { in: selection } } })
  
  return results
}

export function printResultsCsv(resultset) {
  var fields = Object.keys(resultset[0].results)

  // modify order of fields for graphing
  fields.splice(fields.indexOf('sum'), 1);
  fields.splice(fields.indexOf('variance'), 1);
  fields.splice(fields.indexOf('count'), 1);
  fields.push('sum')
  fields.push('variance')
  fields.push('count')

  var replacer = function (key, value) { return value === null ? '' : value }
  var csv = resultset.map(function (row) {
    return fields.map(function (fieldName) {
      return JSON.stringify(row.results[fieldName], replacer)
    }).join(',')
  })

  csv.unshift(fields.join(',')) // add header column

  // add first column with labels
  csv[0] = '-,' + csv[0]
  csv[1] = 'binary,' + csv[1]
  csv[2] = 'node-api,' + csv[2]
  csv = csv.join('\r\n');
  console.log(csv)

  console.log("---- Graph ----")

  var csv = resultset.map(function (row) {
    return row.data.join(',')
  })

  // add first column with labels
  csv[0] = 'binary,' + csv[0]
  csv[1] = 'node-api,' + csv[1]

  console.log(csv.join('\r\n'))
}

export function printResults({ results }) {
  for (const key in results) {
    if (key === 'count') continue
    results[key] = prettyMs(results[key])
  }
  console.log(results)
}

////////////////////////////////////////////////////////////////////////////////

function now() {
  return performance.now()
}

////////////////////////////////////////////////////////////////////////////////

//const suite = new Benchmark.Suite()
//suite
//  .add('', () => {})
//  .on('cycle', function (event) {
//    console.log(String(event.target))
//  })
//  .on('complete', function () {
//    console.log('done')
//  })
//  .run()

////////////////////////////////////////////////////////////////////////////////
