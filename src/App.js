import React, { Component } from 'react';
import axios from 'axios';

const TITLE = 'React GraphQL GitHub Client';

const axiosGitHubGraphQL = axios.create({
  baseURL: 'https://api.github.com/graphql',
  headers: {
    Authorization: `bearer ${process.env.REACT_APP_GITHUB_PERSONAL_ACCESS_TOKEN}`,
  },
});

const GET_ORGANIZATION = `{
  organization(login: "the-road-to-learn-react") {
    name
    url
  }
}`;

const GET_REPOSITORY_OF_ORGANIZATION = `{
  organization(login: "the-road-to-learn-react") {
    name
    url
    repository(name: "the-road-to-learn-react") {
      name
      url
    }
  }
}`;

const GET_ISSUES_OF_REPOSITORY = `
  query ($organization: String!, $repository: String!, $endCursor: String) {
    organization(login: $organization) {
      name
      url
      repository(name: $repository) {
        id
        name
        url
        stargazers {
          totalCount
        }
        viewerHasStarred
        issues(first: 5, after: $endCursor, states: [OPEN]) {
          edges {
            node {
              id
              title
              url
              reactions(last: 3) {
                edges {
                  node {
                    id
                    content
                  }
                }
              }
            }
          }
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
`;

const ADD_STAR = `
  mutation ($repositoryId: ID!) {
    addStar(input:{starrableId:$repositoryId}) {
      starrable {
        viewerHasStarred
      }
    }
  }
`;

const REMOVE_STAR = `
  mutation ($repositoryId: ID!) {
    removeStar(input:{starrableId:$repositoryId}) {
      starrable {
        viewerHasStarred
      }
    }
  }
`;

const Repository = ({ repository, onFetchMoreIssues, onStarRepository }) => (
  <div>
    <p>
      <strong>In Repository:</strong>
      <a href={repository.url}>{repository.name}</a>
    </p>
    <button type="button" onClick={() => onStarRepository(repository.id, repository.viewerHasStarred)}>
      {repository.viewerHasStarred ? 'Unstar ' : 'Star '}
      {repository.stargazers.totalCount}
    </button>
    <ul>
      {repository.issues.edges.map((issue) => (
        <li key={issue.node.id}>
          <a href={issue.node.url}>{issue.node.title}</a>
          <ul>
            {issue.node.reactions.edges.map((reaction) => (
              <li key={reaction.node.id}>{reaction.node.content}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
    <hr />
    {repository.issues.pageInfo.hasNextPage && <button onClick={onFetchMoreIssues}>More</button>}
  </div>
);

const Organization = ({ organization, errors, onFetchMoreIssues, onStarRepository }) => {
  if (errors) {
    return (
      <div>
        <p>
          <strong>Something went wrong:</strong>
          {errors.map((error) => error.message).join(' ')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p>
        <strong>Issues from Organization:</strong>
        <a href={organization.url}>{organization.name}</a>
        <Repository
          repository={organization.repository}
          onFetchMoreIssues={onFetchMoreIssues}
          onStarRepository={onStarRepository}
        />
      </p>
    </div>
  );
};

class App extends Component {
  state = {
    path: 'the-road-to-learn-react/the-road-to-learn-react',
    organization: null,
    errors: null,
  };
  componentDidMount() {
    this.onFetchFromGitHub(this.state.path);
  }
  onChange = (event) => {
    this.setState({ path: event.target.value });
  };
  onSubmit = (event) => {
    this.onFetchFromGitHub(this.state.path);
    event.preventDefault();
  };
  onFetchFromGitHub = (path, endCursor) => {
    const [organization, repository] = path.split('/');

    axiosGitHubGraphQL
      .post('', { query: GET_ISSUES_OF_REPOSITORY, variables: { organization, repository, endCursor } })
      .then((result) => {
        const { data, errors } = result.data;

        if (!endCursor) {
          return this.setState(() => ({
            organization: data.organization,
            errors,
          }));
        }

        const { edges: oldIssues } = this.state.organization.repository.issues;
        const { edges: newIssues } = data.organization.repository.issues;
        const updatedIssues = [...oldIssues, ...newIssues];

        this.setState(() => ({
          organization: {
            ...data.organization,
            repository: {
              ...data.organization.repository,
              issues: {
                ...data.organization.repository.issues,
                edges: updatedIssues,
              },
            },
          },
          errors,
        }));
      });
  };
  onFetchMoreIssues = () => {
    const { endCursor } = this.state.organization.repository.issues.pageInfo;

    this.onFetchFromGitHub(this.state.path, endCursor);
  };
  onStarRepository = (repositoryId, viewerHasStarred) => {
    if (viewerHasStarred) {
      return axiosGitHubGraphQL
        .post('', {
          query: REMOVE_STAR,
          variables: { repositoryId },
        })
        .then((result) => {
          const { viewerHasStarred } = result.data.data.removeStar.starrable;

          this.setState((s) => ({
            ...s,
            organization: {
              ...s.organization,
              repository: {
                ...s.organization.repository,
                stargazers: {
                  totalCount: s.organization.repository.stargazers.totalCount - 1,
                },
                viewerHasStarred,
              },
            },
          }));
        });
    }

    return axiosGitHubGraphQL
      .post('', {
        query: ADD_STAR,
        variables: { repositoryId },
      })
      .then((result) => {
        const { viewerHasStarred } = result.data.data.addStar.starrable;

        this.setState((s) => ({
          ...s,
          organization: {
            ...s.organization,
            repository: {
              ...s.organization.repository,
              stargazers: {
                totalCount: s.organization.repository.stargazers.totalCount + 1,
              },
              viewerHasStarred,
            },
          },
        }));
      });
  };

  render() {
    const { path, organization, errors } = this.state;

    return (
      <div>
        <h1>{TITLE}</h1>
        <form onSubmit={this.onSubmit}>
          <label htmlFor="url">Show open issues for https://github.com/</label>
          <input id="url" type="text" value={path} onChange={this.onChange} style={{ width: '300px' }} />
          <button type="submit">Search</button>
        </form>
        <hr />
        {organization ? (
          <Organization
            organization={organization}
            errors={errors}
            onFetchMoreIssues={this.onFetchMoreIssues}
            onStarRepository={this.onStarRepository}
          />
        ) : (
          <p>No information yet ...</p>
        )}
      </div>
    );
  }
}

export default App;
