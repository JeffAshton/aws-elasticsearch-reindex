# aws-elasticsearch-reindex

Command line tools for reindexing aws elasticsearch indices.

## Usage

Running the `aws-elasticsearch-reindex` command line will create reindex tasks.  A file containing the corresponding task ids will be created next to your reindex command(s) file.

```
aws-elasticsearch-reindex https://mydomain.us-east-1.es.amazonaws.com reindex.json
```

To wait for the tasks to run to completion, use the `aws-elasticsearch-reindex-waiter` command line tool and the `tasks.json` file generated in the previous step.

```
aws-elasticsearch-reindex-waiter https://mydomain.us-east-1.es.amazonaws.com reindex.2019-09-03T21-05-34.322Z.tasks.json
```


