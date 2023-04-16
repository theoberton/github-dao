import { createContext, useEffect, useMemo, useReducer, useState } from 'react';
import { NapkinVoteProvider } from '@/stores/vote-provider/NapkinVoteProvider';
import { LocalStorageProvider } from '@/stores/vote-provider/LocalStorageProvider';
import { Repo } from './repo';
import { isLocalhost } from '@/utils/isLocalhost';

export interface DaoState {
  proposals: {
    number: number
    transactions: {
      from: string
      comment: 'yes' | 'no'
    }[]
  }[]
}

type Action<T extends string, P = void> = P extends void
  ? { type: T }
  : { type: T; payload: P }

type VoteAction = Action<'vote', { number: number, from: string, comment: 'yes' | 'no' }>
type ResetAction = Action<'reset'>
type RevokeVotesAction = Action<'revoke_votes', { from: string }>
type RandomizeAction = Action<'randomize'>
export type DaoAction = VoteAction | ResetAction | RandomizeAction | RevokeVotesAction;

export const initialState: DaoState = {
  proposals: []
}

function reducer(state: DaoState, action: DaoAction): DaoState {
  switch (action.type) {
    case 'vote': {
      const proposals = [...state.proposals];

      if (!proposals.find((proposal) => proposal.number === action.payload.number)) {
        proposals.push({
          number: action.payload.number,
          transactions: []
        });
      }

      return {
        ...state,
        proposals: proposals.map((proposal) => {
          if (proposal.number === action.payload.number) {
            if (proposal.transactions.find((transaction) => transaction.from === action.payload.from)) {
              return proposal;
            }

            return {
              ...proposal,
              transactions: [
                ...proposal.transactions,
                {
                  from: action.payload.from,
                  comment: action.payload.comment
                }
              ]
            }
          }

          return proposal;
        })
      }
    }
    // For development purposes only
    case 'randomize': {
      return {
        ...state,
        proposals: state.proposals.map((proposal) => {
          return {
            ...proposal,
            transactions: [
              ...proposal.transactions,
              ...[...Array(Math.floor(Math.random() * 10))].map(() => {
                return {
                  from: '0x' + Math.random().toString(16),
                  comment: Math.random() > 0.5 ? 'yes' as const : 'no' as const
                }
              })
            ]
          }}),
      }
    }
    // For development purposes only
    case 'reset': {
      return initialState;
    }
    // For development purposes only?
    case 'revoke_votes': {
      return {
        ...state,
        proposals: state.proposals.map((proposal) => {
          return {
            ...proposal,
            transactions: proposal.transactions.filter((transaction) => transaction.from !== action.payload.from)
          }
        }
      )}
    }
  }
}

export const DaoStateContext = createContext<DaoState>(initialState);
export const DaoStateDispatchContext = createContext<React.Dispatch<DaoAction>>(() => {});



export function DaoStateProvider({ children, repo }: { children: React.ReactNode, repo: Repo }) {
  const [loading, setLoading] = useState(true);
  const [daoState, dispatch] = useReducer(reducer, initialState);

  /* CHOOSE PROVIDER */
  const votesProvider = useMemo(() => {
    const repoNs = repo?.owner.login + '/' + repo?.name;

    return isLocalhost()
      ? new LocalStorageProvider(repoNs)
      : new NapkinVoteProvider(repoNs); // persistent and shared using napkin.io
  }, [repo]); 

  useEffect(() => {
    (async () => {
      const votes = await votesProvider.getVotes();

      votes.forEach((vote) => {
        dispatch({ type: 'vote', payload: vote });
      });

      setLoading(false);
    })();
  }, [votesProvider]);

  const dispatchWithSideEffects = async (action: DaoAction) => {
    dispatch(action);

    switch(action.type) {
      case 'vote': {
        await votesProvider.insertVote(action.payload);
      }
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <DaoStateContext.Provider value={daoState}>
      <DaoStateDispatchContext.Provider value={dispatchWithSideEffects}>
        {children}
      </DaoStateDispatchContext.Provider>
    </DaoStateContext.Provider>
  );
}