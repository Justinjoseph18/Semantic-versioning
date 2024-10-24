const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('child_process').exec;

async function run() {
  try {
    const token = core.getInput('github_token');
    const octokit = github.getOctokit(token);
    const { context } = github;
    const pr = context.payload.pull_request;

    if (!pr.merged) {
      core.info('PR not merged. Exiting.');
      return;
    }

    const prTitle = pr.title;
    let bumpType = 'none';

    if (prTitle.startsWith('feat!') || prTitle.startsWith('fix!') || prTitle.includes('BREAKING CHANGE')) {
      bumpType = 'major';
    } else if (prTitle.startsWith('feat:')) {
      bumpType = 'minor';
    } else if (prTitle.startsWith('fix:')) {
      bumpType = 'patch';
    }

    if (bumpType === 'none') {
      core.info('No version bump. Exiting.');
      return;
    }

    exec('git fetch --tags', () => {
      exec('git describe --tags --abbrev=0', (err, tag) => {
        tag = tag ? tag.trim() : 'v0.0.0';
        const [major, minor, patch] = tag.replace('v', '').split('.').map(Number);

        let newVersion;
        if (bumpType === 'major') {
          newVersion = `${major + 1}.0.0`;
        } else if (bumpType === 'minor') {
          newVersion = `${major}.${minor + 1}.0`;
        } else {
          newVersion = `${major}.${minor}.${patch + 1}`;
        }

        exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`, () => {
          exec(`git push origin v${newVersion}`, () => {
            octokit.rest.repos.createRelease({
              owner: context.repo.owner,
              repo: context.repo.repo,
              tag_name: `v${newVersion}`,
              name: `Release v${newVersion}`,
              body: `PR #${pr.number}: ${pr.title}`
            });
          });
        });
      });
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
