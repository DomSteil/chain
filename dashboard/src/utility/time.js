/**
 * Calculates the average change per second of a variable sampled at various times.
 */
 export class DeltaSampler {
  constructor({sampleTtl = 60*1000, maxSamples = 60} = {}) {
    this.sampleTtl = sampleTtl
    this.maxSamples = maxSamples
    this.samples = []
  }

  sample(value) {
    this.samples.push({
      value,
      time: Date.now(),
    })

    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }

    return this.average()
  }

  /**
   * Returns the average growth of the value per second.
   * Algorithm: sum the changes
   */
  average() {
    const cutoff = Date.now() - this.sampleTtl
    const deltas = []

    let earliest = null
    let latest = null

    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i]
      if (s.time < cutoff) continue
      if (earliest === null) earliest = s
      latest = s
    }

    if (earliest === latest) {
      return NaN
    }

    return 1000 * (latest.value - earliest.value) / (latest.time - earliest.time)
  }
}

export const humanizeDuration = seconds => {
  let big, little, bigUnit, littleUnit

  if (seconds > 24 * 60 * 60) {
    big = seconds / (24 * 60 * 60)
    little = seconds % (24 * 60 * 60)
    bigUnit = 'd'
    littleUnit = 'h'
  } else if (seconds > 60 * 60) {
    big = seconds / (60 * 60)
    little = seconds % (60 * 60)
    bigUnit = 'h'
    littleUnit = 'm'
  } else if (seconds > 60) {
    big = seconds / 60
    little = seconds % 60
    bigUnit = 'm'
    littleUnit = 's'
  } else {
    return `${Math.round(seconds)}s`
  }

  big = Math.floor(big)
  little = Math.round(little)

  if (big > 9) {
    return `${big}${bigUnit}`
  }

  return `${big}${bigUnit} ${little}${littleUnit}`
}
