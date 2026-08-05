import { seedPilotDemo } from './seedPilotDemoCore'

async function main() {
  console.log('--- Seeding Kitengela International Schools pilot demo ---')
  const result = await seedPilotDemo()
  console.log(`Removed ${result.removedStaleUsers} stale demo users.`)
  console.log('--- Done ---')
  console.log(`Institution: ${result.institutionName} (${result.campus})`)
  console.log(`Teachers: ${result.teacherCount}, Students: ${result.studentCount}, Classes: ${result.classCount}, Activities: ${result.activityCount}`)
  console.log(`Focus sessions: ${result.totalSessions}, Tasks: ${result.totalTasks} (${result.totalCompletedTasks} completed), Quiz attempts: ${result.totalAttempts}`)
  console.log('All demo accounts use password: PilotDemo2026!')
  console.log('Example logins: pilot-grace.mwangi@kitengela.demo (teacher), pilot-amani.wanjiru@kitengela.demo (student)')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed to seed pilot demo data:', error)
    process.exit(1)
  })
