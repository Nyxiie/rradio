import { useStore } from '../store'
import { playerStore, type PlayerState } from './engine'

export function usePlayer<S>(selector: (s: PlayerState) => S): S {
  return useStore(playerStore, selector)
}
