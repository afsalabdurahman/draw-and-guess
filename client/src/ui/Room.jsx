import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { socket, emitPromise } from '../socket';
import { useGameStore } from '../store/useGameStore';
import Canvas from './Canvas';
import Toolbox from './Toolbox';
import Countdown from './Countdown';
import WordPicker from './WordPicker';
import Scoreboard from './Scoreboard';
import Chat from './Chat';

export default function Room() {
  const { id: roomId } = useParams();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  
  const players = useGameStore((state) => state.players);
  const phase = useGameStore((state) => state.phase);
  const hostId = useGameStore((state) => state.hostId);
  const drawerId = useGameStore((state) => state.drawerId);
  const secretWord = useGameStore((state) => state.secretWord);
  const hintMask = useGameStore((state) => state.hintMask);
  const paused = useGameStore((state) => state.paused);
  const settings = useGameStore((state) => state.settings);
  const setRoomInfo = useGameStore((state) => state.setRoomInfo);
  const playerId = useGameStore((state) => state.playerId);

  const [needsName, setNeedsName] = useState(false);
  const isHost = playerId && hostId === playerId;
  
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    const tryJoin = async () => {
      const storedToken = localStorage.getItem(`pictionary_room_${roomId}_token`);
      const tempName = sessionStorage.getItem('tempName');

      if (!storedToken && !tempName) {
        setNeedsName(true);
        return;
      }

      joinRoom(tempName || 'Reconnecting...', storedToken);
      sessionStorage.removeItem('tempName');
    };

    tryJoin();

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  const joinRoom = async (playerName, reconnectToken = null) => {
    setJoining(true);
    setError(null);
    try {
      if (!socket.connected) {
        socket.connect();
      }

      const res = await emitPromise('room:join', {
        roomId,
        name: playerName,
        ...(reconnectToken && { reconnectToken })
      });

      setRoomInfo(roomId, res.playerId, res.reconnectToken);
      localStorage.setItem(`pictionary_room_${roomId}_token`, res.reconnectToken);
      setNeedsName(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setNeedsName(true);
      socket.disconnect();
    } finally {
      setJoining(false);
    }
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    joinRoom(name.trim());
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };
  
  const updateSetting = async (key, value) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    try {
        await emitPromise('settings:update', { roomId, settings: newSettings });
    } catch (e) {
        alert(e.message);
        setLocalSettings(settings);
    }
  };

  const updateWordList = async (value) => {
    let wordList = value === 'default' ? 'default' : value.split(',').map(s => s.trim()).filter(Boolean);
    if (Array.isArray(wordList) && wordList.length === 0) {
        wordList = 'default';
    }
    const newSettings = { ...localSettings, wordList };
    setLocalSettings(newSettings);
    try {
        await emitPromise('settings:update', { roomId, settings: newSettings });
    } catch (e) {
        alert(e.message);
        setLocalSettings(settings);
    }
  };

  const startGame = async () => {
    try {
        await emitPromise('game:start', { roomId });
    } catch (e) {
        alert(e.message);
    }
  };

  if (needsName) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md">
          <h2 className="text-2xl font-bold text-white mb-6">Join Room</h2>
          {error && <div className="mb-4 text-red-400 text-sm bg-red-400/10 p-3 rounded">{error}</div>}
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <input
              type="text"
              required
              maxLength={20}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="submit"
              disabled={joining}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {joining ? 'Joining...' : 'Join Game'}
            </button>
          </form>
        </div>
      </div>
    );
  }
  
  const connectedPlayers = players.filter(p => p.connected).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Col: Toolbox (if playing) */}
        {phase !== 'LOBBY' && (
          <div className="hidden lg:block">
             <Toolbox />
          </div>
        )}

        {/* Center/Main Area */}
        <div className={phase === 'LOBBY' ? "lg:col-span-3 space-y-6" : "lg:col-span-2 space-y-6"}>
            <div className="flex justify-between items-center bg-slate-800 rounded-xl p-6 shadow-xl">
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Room: {roomId}</h1>
                <p className="text-slate-400 font-medium">Phase: <span className="text-yellow-400">{phase}</span></p>
                {phase === 'DRAWING' && hintMask && (
                    <div className="text-2xl tracking-widest font-mono mt-2 bg-slate-900 py-1 px-4 rounded inline-block text-white">
                        {hintMask}
                    </div>
                )}
            </div>
            <button
                onClick={copyLink}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
            >
                <Copy size={18} />
                Copy Invite Link
            </button>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 shadow-xl flex flex-col items-center justify-center relative">
                {phase === 'LOBBY' ? (
                    <div className="text-center aspect-video flex flex-col justify-center border-2 border-slate-700 border-dashed rounded-lg w-full">
                        <p className="text-slate-400 mb-4">Waiting for game to start...</p>
                        {isHost && (
                            <button
                                onClick={startGame}
                                disabled={connectedPlayers < 2}
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mx-auto"
                            >
                                Start Game
                            </button>
                        )}
                        {isHost && connectedPlayers < 2 && (
                            <p className="text-red-400 text-sm mt-2">Need at least 2 connected players to start</p>
                        )}
                    </div>
                ) : (
                    <>
                      {phase === 'CHOOSING_WORD' && playerId === drawerId && (
                          <WordPicker />
                      )}
                      
                      {phase === 'CHOOSING_WORD' && playerId !== drawerId && (
                          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] z-40 flex items-center justify-center">
                              <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-700 text-center">
                                  <div className="text-2xl font-bold text-slate-300">
                                      The drawer is choosing a word...
                                  </div>
                              </div>
                          </div>
                      )}
                      
                      {phase === 'TURN_END' && (
                          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur z-40 flex flex-col items-center justify-center">
                              {/* The Scoreboard modal handles this now */}
                          </div>
                      )}

                      {paused && (
                          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur z-50 flex items-center justify-center">
                              <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-yellow-500/50 text-center animate-pulse">
                                  <div className="text-4xl font-black text-yellow-400 mb-2">Game Paused</div>
                                  <div className="text-xl text-slate-300">Waiting for players to reconnect...</div>
                              </div>
                          </div>
                      )}

                      {paused && (
                          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur z-50 flex items-center justify-center">
                              <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-yellow-500/50 text-center animate-pulse">
                                  <div className="text-4xl font-black text-yellow-400 mb-2">Game Paused</div>
                                  <div className="text-xl text-slate-300">Waiting for players to reconnect...</div>
                              </div>
                          </div>
                      )}

                      <div className="w-full mb-4 lg:hidden">
                        <Toolbox />
                      </div>
                      <div className="w-full relative aspect-[4/3] rounded-lg overflow-hidden bg-white/5 border-2 border-slate-700">
                        <Countdown />
                        <Canvas disabled={false} />
                      </div>
                    </>
                )}
                
                <Scoreboard />
            </div>
        </div>

        {/* Right Col: Sidebar (Players / Settings / Chat) */}
        <div className="space-y-6 h-[80vh] flex flex-col">
            <div className="bg-slate-800 rounded-xl p-4 shadow-xl">
            <h2 className="text-xl font-semibold mb-2">Players ({connectedPlayers}/{settings.maxPlayers})</h2>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
                {players.map((p) => (
                <li key={p.id} className={`flex justify-between items-center p-3 rounded-lg bg-slate-700/50 ${!p.connected ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${p.connected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    <div className="flex flex-col">
                        <span className="font-medium flex items-center gap-2">
                            {p.name} {p.id === playerId ? '(You)' : ''}
                            {p.id === hostId && (
                                <span className="text-[10px] uppercase font-bold tracking-wider bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Host</span>
                            )}
                        </span>
                    </div>
                    </div>
                    <span className="text-slate-400 font-medium">{p.score} pts</span>
                </li>
                ))}
            </ul>
            </div>

            {phase === 'LOBBY' && (
              <div className="bg-slate-800 rounded-xl p-6 shadow-xl">
                  <h2 className="text-xl font-semibold mb-4">Settings</h2>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm text-slate-400 mb-1">Rounds</label>
                          {isHost ? (
                              <input 
                                  type="number" 
                                  min="1" max="10" 
                                  value={localSettings.rounds}
                                  onChange={e => updateSetting('rounds', parseInt(e.target.value))}
                                  className="w-full bg-slate-700 rounded px-3 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                          ) : (
                              <div className="text-lg">{settings.rounds}</div>
                          )}
                      </div>
                      <div>
                          <label className="block text-sm text-slate-400 mb-1">Draw Time (seconds)</label>
                          {isHost ? (
                              <input 
                                  type="number" 
                                  min="30" max="180" step="10"
                                  value={localSettings.drawTimeSec}
                                  onChange={e => updateSetting('drawTimeSec', parseInt(e.target.value))}
                                  className="w-full bg-slate-700 rounded px-3 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                          ) : (
                              <div className="text-lg">{settings.drawTimeSec}s</div>
                          )}
                      </div>
                      <div>
                          <label className="block text-sm text-slate-400 mb-1">Max Players</label>
                          {isHost ? (
                              <input 
                                  type="number" 
                                  min="2" max="12" 
                                  value={localSettings.maxPlayers}
                                  onChange={e => updateSetting('maxPlayers', parseInt(e.target.value))}
                                  className="w-full bg-slate-700 rounded px-3 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                          ) : (
                              <div className="text-lg">{settings.maxPlayers}</div>
                          )}
                      </div>
                      <div>
                          <label className="block text-sm text-slate-400 mb-1">Word List</label>
                          {isHost ? (
                              <textarea 
                                  value={localSettings.wordList === 'default' ? '' : localSettings.wordList.join(', ')}
                                  onChange={e => updateWordList(e.target.value ? e.target.value : 'default')}
                                  placeholder="Leave empty for default, or comma separated words"
                                  className="w-full bg-slate-700 rounded px-3 py-1 text-sm h-20 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                              />
                          ) : (
                              <div className="text-sm truncate">
                                  {settings.wordList === 'default' ? 'Default' : `${settings.wordList.length} custom words`}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
            )}

            {phase !== 'LOBBY' && (
              <div className="flex-1 min-h-[300px]">
                <Chat />
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
