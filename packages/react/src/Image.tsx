import React, { useState, useEffect, CSSProperties } from 'react';

import Jazzicon from './Jazzicon';

export interface Props {
  size: number;
  uri?: string | null;
  address?: string | null;
  style?: CSSProperties;
  className?: string;
  // 698d3c5351720e4ca3a363dbd33d76d2
  graphApiKey?: string;
}

export default function Avatar({ uri, style, className, size, address, graphApiKey }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!uri) {
      return;
    }

    const match = new RegExp(/([a-z]+):\/\/(.*)/).exec(uri);
    const nftMatch = new RegExp(/eip155:1\/erc721:(\w+)\/(\w+)/).exec(uri);

    if (match && match.length === 3) {
      const protocol = match[1];
      const id = match[2];

      switch (protocol) {
        case 'ar': {
          const baseUrl = 'https://arweave.net';

          fetch(`${baseUrl}/graphql`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json;charset=UTF-8',
            },
            body: JSON.stringify({
              query: `
              {
                transactions(ids: ["${id}"]) {
                  edges {
                    node {
                      id
                      owner {
                        address
                      }
                    }
                  }
                }
              }
              `,
            }),
          })
            .then(d => d.json())
            .then(res => res.data.transactions.edges[0].node)
            .then(tx =>
              fetch(`${baseUrl}/graphql`, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json;charset=UTF-8',
                },
                body: JSON.stringify({
                  query: `
                {
                  transactions(owners: ["${tx.owner.address}"], tags: { name: "Origin", values: ["${tx.id}"] }, sort: HEIGHT_DESC) {
                    edges {
                      node {
                        id
                      }
                    }
                  }
                }
                `,
                }),
              })
            )
            .then(res => res.json())
            .then(res => {
              if (res.data && res.data.transactions.edges.length > 0) {
                setUrl(`${baseUrl}/${res.data.transactions.edges[0].node.id}`);
              } else {
                setUrl(`${baseUrl}/${id}`);
              }
            })
            .catch(e => console.error(e)); // eslint-disable-line

          break;
        }
        case 'ipfs':
          setUrl(`https://gateway.ipfs.io/ipfs/${id}`);
          break;
        case 'ipns':
          setUrl(`https://gateway.ipfs.io/ipns/${id}`);
          break;
        case 'http':
        case 'https':
          setUrl(uri);
          break;
        default:
          setUrl(uri);
          break;
      }
    } else if (graphApiKey && address && nftMatch && nftMatch.length === 3) {
      const contractId = nftMatch[1];
      const tokenId = parseInt(nftMatch[2]).toString(16);
      const normalizedAddress = address.toLowerCase();
      const cacheKey = `${normalizedAddress}/${contractId}/0x${tokenId}`;
      const cachedItem = window.localStorage.getItem(cacheKey);

      if (cachedItem) {
        const item = JSON.parse(cachedItem);

        if (new Date(item.expiresAt) > new Date()) {
          setUrl(item.url);
          return;
        }
      }

      // erc721 subgraph
      fetch(
        `https://gateway.thegraph.com/api/${graphApiKey}/subgraphs/id/0x7859821024e633c5dc8a4fcf86fc52e7720ce525-0`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json;charset=UTF-8',
          },
          body: JSON.stringify({
            query: `
          {
            erc721Token(id: "${contractId}/0x${tokenId}") {
              id
              owner {
                id
              }
              uri
            }
          }
          `,
          }),
        }
      )
        .then(res => res.json())
        .then(async res => {
          if (!res.data || !res.data.erc721Token) {
            throw new Error('invalid ERC721 token');
          }

          const token = res.data.erc721Token;

          if (token.owner.id.toLowerCase() !== normalizedAddress) {
            throw new Error('ERC721 token not owned by address');
          }

          return token;
        })
        .then(token => fetch(token.uri))
        .then(res => res.json())
        .then(data => {
          // 24 hour TTL
          const expireDate = new Date(new Date().getTime() + 60 * 60 * 24 * 1000);

          window.localStorage.setItem(cacheKey, JSON.stringify({ url: data.image, expiresAt: expireDate }));
          setUrl(data.image);
        });
    } else {
      setUrl(uri);
    }
  }, [uri, address, graphApiKey]);

  if (!url) {
    if (address) {
      return <Jazzicon address={address} size={size} />;
    } else {
      return null;
    }
  }

  const cssStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: `${size}px`,
    ...(style || {}),
  };

  return <img alt="avatar" style={cssStyle} className={className} src={url} />;
}
