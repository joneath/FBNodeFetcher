# FBNodeFetcher

FBNodeFetcher is a Node.js app to fetch Facebook graph node data asynchronously. FBNodeFetcher takes a stream of JSON node data and forwards the response data to the desired callback url.

## Usage

###### Install
`npm install -g git://github.com/joneath/FBNodeFetcher.git`

###### Run
`FBNodeFetcher`

### Fetch
Send a POST request to http://localhost:1337/fetch with `callbackUrl` and `nodes` params.

    post_args = {
        'nodes' => nodes,
        'callbackUrl' => "http://example.com/my_callback_url"
    }

#### CallbackUrl
  The URL to stream the data as is comes in from Facebook.

#### Nodes

    [
      {
        node: {
          graph_id: "1234567890",
          connection: "feed",
          access_token: "1234567890_ABCDEF",
          priority: 1,
          pages_back: 1,
          latest: ""
        }
      }
    ]

  Nodes is an array of request objects. Each node is a unique request that is fetched asynchronously.

  * `graph_id` - The graph ID of the node to fetch
  * `connection` *(optional)* - The connection off of the node to fetch
  * `access_token` - The graph ID to fetch
  * `priority` - The priority this node will be fetch. Lower is higher priority.
  * `pages_back` *(optional)* - How many pages to retrive. This will run synchronously and return the entire collection.
  * `until` *(optional, graph_id)* - Fetches until graph ID is found. This will run synchronously and return the entire collection.

### Fetch Response (JSON Object)
`FBNodeFetcher.fetch()` always returns the same formatted JSON as the [Facebook Open Graph](https://developers.facebook.com/docs/reference/api/). The only minor difference is when using the `pages_back` and `latest_id` options, where the returned JSON is a much larger aggregate of all the pages.

### Ratchet
Send a POST request to http://localhost:1337/ratchet with `direction`, `queue` and `delta` params.

    post_args = {
        'direction' => "up",
        'queue' => "fetch",
        'delta' => 10
    }

  * `direction` - `"up" || "down"` This is the direction you want to ratchet the fetch. Up for faster, down for slower.
  * `queue` - `"fetch" || "process"` This is the Queue you want to ratchet. `fetch` is the Facebook fetch queue and `process` is the queue to send the data to your server.
  * `delta` *(optional)* - The delta represents how much to ratchet up or down the queues. Both queues start at 100 jobs allowed to run at a time. By default the delta per ratchet is set to 10% of the current.

