// Nightly full regression on the local Jenkins (jenkins/docker-compose.yml).
// Runs the suite in Docker via scripts/test-docker.sh, like .github/workflows/ci.yml.
pipeline {
  agent any

  triggers {
    // ~02:00 Europe/Amsterdam (JVM timezone set in jenkins/docker-compose.yml)
    cron('H 2 * * *')
  }

  parameters {
    // Cron builds use the default (full)
    choice(name: 'SUITE', choices: ['full', 'smoke'], description: 'Test suite to run')
  }

  options {
    timestamps()
    timeout(time: 45, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    // One test stack per dind daemon (fixed ports, same compose project)
    disableConcurrentBuilds()
  }

  environment {
    // Passed to the tests container: retries 1 and forbidOnly (playwright.config.ts)
    CI = 'true'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Tests') {
      steps {
        // Demo values, no secrets (as in ci.yml)
        sh 'cp .env.example .env'
        sh '''
          if [ "$SUITE" = full ]; then
            npm run test:docker
          else
            npm run test:docker:smoke
          fi
        '''
      }
    }
  }

  post {
    always {
      junit testResults: 'reports/junit.xml', allowEmptyResults: true
      publishHTML(target: [
        reportDir: 'playwright-report',
        reportFiles: 'index.html',
        reportName: 'Playwright report',
        keepAll: true,
        alwaysLinkToLastBuild: true,
        allowMissing: true,
      ])
      archiveArtifacts artifacts: 'reports/**, test-results/**', allowEmptyArchive: true
    }
    failure {
      // ===== n8n webhook (next step) =====
      // TODO: POST the build result (job, build URL, SUITE, reports/results.json counts)
      // to the n8n webhook. No URL yet; keep it in a Jenkins credential, not in this file.
      echo 'n8n notification: not configured yet'
    }
    cleanup {
      // Last, after failure: the n8n step can still read reports/ from the workspace
      cleanWs()
    }
  }
}
