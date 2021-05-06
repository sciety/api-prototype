import chalk from 'chalk'
import { log } from 'fp-ts/Console'
import { constant, flow } from 'fp-ts/function'
import * as IO from 'fp-ts/IO'
import * as T from 'fp-ts/Task'
import * as TE from 'fp-ts/TaskEither'

const exitProcess = (code: 0 | 1) => () => process.exit(code)

const onFailure = flow(chalk.bold.red, log)

const onSuccess = flow(constant('Success!'), chalk.bold.green, log)

const onLeft = flow(onFailure, IO.chain(exitProcess(1)), T.fromIO)

const onRight = flow(onSuccess, IO.chain(exitProcess(0)), T.fromIO)

export const exit = TE.matchE(onLeft, onRight)
