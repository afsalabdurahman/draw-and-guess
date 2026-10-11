import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/rooms', { method: 'POST' });
      const data = await res.json();
      
      sessionStorage.setItem('tempName', name.trim());
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create room');
    } finally {
      setLoading(false);
    }
  };


    return (
        <div className="pictionary-bg min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background doodles */}
            <div className="doodle doodle-one">✏️</div>
            <div className="doodle doodle-two">⭐</div>
            <div className="doodle doodle-three">🎨</div>
            <div className="doodle doodle-four">💡</div>

            {/* Room creation card */}
            <div className="relative z-10 bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/60">
                <h1 className="text-4xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
                    Pictionary
                </h1>

                <form onSubmit={handleCreateRoom} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Enter Your Name
                        </label>
                        <input
                            type="text"
                            required
                            maxLength={20}
                            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="e.g. Picasso"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all hover:scale-[1.02] disabled:opacity-50"
                    >
                        {loading ? "Creating..." : "Create Room"}
                    </button>
                </form>
            </div>
        </div>
    );

}
