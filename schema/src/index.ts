import { Command } from 'commander'
import { runTest } from './run-tests'

const run = async () => {
  const program = new Command()

  program
    .description('Test SHACL shapes')
    .requiredOption('-t, --test-cases <glob>', 'Test cases')
    .requiredOption('-s, --shapes <glob>', 'Shapes')
    .action(runTest)

  await program.parseAsync()
}

run().catch(console.error)
