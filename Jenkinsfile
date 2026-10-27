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
    // params.SUITE is empty on the first build (parameter not registered yet): default to full
    SUITE = "${params.SUITE ?: 'full'}"
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
        echo "Suite: ${env.SUITE}"
        // Fail-safe: only an explicit smoke runs smoke, anything else runs full
        sh '''
          if [ "$SUITE" = smoke ]; then
            npm run test:docker:smoke
          else
            npm run test:docker
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
      // n8n (n8n/README.md): Jira issue per failed test, email digest, Excel tracker.
      // The webhook URL is the Secret text credential n8n-webhook-url, not in this file.
      // A missing credential or an unreachable n8n only logs a warning: the build stays FAILURE.
      script {
        try {
          withCredentials([string(credentialsId: 'n8n-webhook-url', variable: 'N8N_WEBHOOK_URL')]) {
            sh '''
              mkdir -p reports
              node reporting/failure-payload.mts > reports/failure-payload.json
              curl -fsS --max-time 20 -H 'Content-Type: application/json' \
                --data @reports/failure-payload.json "$N8N_WEBHOOK_URL" \
                || echo "WARNING: n8n webhook not reached; the build stays FAILURE"
            '''
          }
        } catch (err) {
          echo "WARNING: n8n notification skipped: ${err}"
        }
      }
    }
    cleanup {
      // Last, after failure: the n8n step can still read reports/ from the workspace
      cleanWs()
    }
  }
}
