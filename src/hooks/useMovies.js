import { useState, useEffect } from 'react';

const MOCK_MOVIES = [
  { id: 1, title: 'The Dark Knight', poster: 'https://image.tmdb.org/t/p/w300/qJ2tW6WMUDux911r6m7haRef0WH.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/hkBaDkMWbLaf8B1lsWsKX7Ew3Xq.jpg', overview: 'When the menace known as the Joker wreaks havoc on Gotham City, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.', rating: '9.0', year: '2008', genre: 'Action, Crime', type: 'movie' },
  { id: 2, title: 'Inception', poster: 'https://image.tmdb.org/t/p/w300/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/s2bT29y0ngXxxu2IA8AOzzXTRhd.jpg', overview: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.', rating: '8.8', year: '2010', genre: 'Action, Sci-Fi', type: 'movie' },
  { id: 3, title: 'Interstellar', poster: 'https://image.tmdb.org/t/p/w300/gEU2QniE6E77NI6lCU6MxlNBvIE.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/xJHokMbljvjADYdit5fK5VQsXEG.jpg', overview: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.", rating: '8.6', year: '2014', genre: 'Adventure, Sci-Fi', type: 'movie' },
  { id: 4, title: 'The Matrix', poster: 'https://image.tmdb.org/t/p/w300/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/vkAqDcmbNXbRN5V5F7SFWM2rABF.jpg', overview: 'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.', rating: '8.7', year: '1999', genre: 'Action, Sci-Fi', type: 'movie' },
  { id: 5, title: 'Avengers: Endgame', poster: 'https://image.tmdb.org/t/p/w300/or06FN3Dka5tukK1e9sl16pB3iy.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg', overview: 'After the devastating events of Infinity War, the Avengers assemble once more to reverse Thanos\' actions.', rating: '8.4', year: '2019', genre: 'Action, Adventure', type: 'movie' },
  { id: 6, title: 'Dune: Part Two', poster: 'https://image.tmdb.org/t/p/w300/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/eeijXm3553xvJxWH3XlBNt3BHGG.jpg', overview: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.', rating: '8.5', year: '2024', genre: 'Adventure, Sci-Fi', type: 'movie' },
  { id: 7, title: 'Oppenheimer', poster: 'https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg', overview: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.', rating: '8.3', year: '2023', genre: 'Biography, Drama', type: 'movie' },
  { id: 8, title: 'Parasite', poster: 'https://image.tmdb.org/t/p/w300/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg', overview: "All unemployed, Ki-taek's family take peculiar interest in the wealthy Parks' family, as they slowly get entangled in an unexpected incident.", rating: '8.5', year: '2019', genre: 'Comedy, Thriller', type: 'movie' },
  { id: 9, title: 'Spider-Man: NWH', poster: 'https://image.tmdb.org/t/p/w300/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/iQFcwSGbZXMkeyKrxbPnwnRo5fl.jpg', overview: 'Peter Parker is unmasked and can no longer separate his normal life from the high-stakes of being a super-hero.', rating: '8.2', year: '2021', genre: 'Action, Adventure', type: 'movie' },
  { id: 10, title: 'Everything Everywhere All At Once', poster: 'https://image.tmdb.org/t/p/w300/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/ii8QGav2XiGCNLoyXZlYNHBEMrB.jpg', overview: 'An aging Chinese immigrant is swept up in an insane adventure, where she alone can save the world by exploring other universes.', rating: '7.8', year: '2022', genre: 'Action, Comedy, Sci-Fi', type: 'movie' },
];

const MOCK_SERIES = [
  { id: 101, title: 'Breaking Bad', poster: 'https://image.tmdb.org/t/p/w300/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg', overview: 'A high school chemistry teacher turned methamphetamine manufacturing drug dealer teams with a former student.', rating: '9.5', year: '2008', genre: 'Crime, Drama, Thriller', type: 'series' },
  { id: 102, title: 'Game of Thrones', poster: 'https://image.tmdb.org/t/p/w300/7WUHnWGx5OrhZMH0fPsRJCbHKZD.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/suopoADq0k8YZr4dQXcU6pToj6s.jpg', overview: 'Nine noble families fight for control over the mythical lands of Westeros, while a forgotten race returns.', rating: '9.2', year: '2011', genre: 'Action, Drama, Fantasy', type: 'series' },
  { id: 103, title: 'Stranger Things', poster: 'https://image.tmdb.org/t/p/w300/x2LSRK2Cm7MZhjluni1msVJ3wDj.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/56v2KjBlU4XaOv9rVYEQypROD7P.jpg', overview: 'When a young boy disappears, his mother, a police chief, and his friends must confront terrifying supernatural forces.', rating: '8.7', year: '2016', genre: 'Drama, Fantasy, Horror', type: 'series' },
  { id: 104, title: 'The Last of Us', poster: 'https://image.tmdb.org/t/p/w300/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/uDgy6hyPd82kOHh6I95iFqiNcc5.jpg', overview: "Joel, a hardened survivor, is hired to smuggle Ellie out of a quarantine zone in a post-apocalyptic world.", rating: '8.8', year: '2023', genre: 'Action, Drama, Sci-Fi', type: 'series' },
  { id: 105, title: 'Squid Game', poster: 'https://image.tmdb.org/t/p/w300/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/qw3J9cNeLioOLoR68WX7z79aCdK.jpg', overview: "Hundreds of cash-strapped players accept a strange invitation to compete in children's games for a deadly prize.", rating: '8.0', year: '2021', genre: 'Action, Drama, Mystery', type: 'series' },
  { id: 106, title: 'Peaky Blinders', poster: 'https://image.tmdb.org/t/p/w300/vUUqzWa2LnHIVqkaKVn3nyfYBNa.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/wiE9dioxmGN59jQ7CXuBpOJdq0L.jpg', overview: 'A gangster family epic set in 1919 Birmingham, England centered on a gang who sew razor blades in the peaks of their caps.', rating: '8.8', year: '2013', genre: 'Crime, Drama, History', type: 'series' },
  { id: 107, title: 'House of the Dragon', poster: 'https://image.tmdb.org/t/p/w300/z2yahl2uefxDCl0nogcRBstwruJ.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/etj8E2o0Bud0HkONVQPjyCkIvpv.jpg', overview: 'The story of House Targaryen set 200 years before the events of Game of Thrones.', rating: '8.4', year: '2022', genre: 'Action, Adventure, Drama', type: 'series' },
  { id: 108, title: 'The Witcher', poster: 'https://image.tmdb.org/t/p/w300/cZ0d3rtvXPVvuiX22sP79K3Hmjz.jpg', backdrop: 'https://image.tmdb.org/t/p/w1280/jBJWaqoSCiARWtfV0GlqHrcdidd.jpg', overview: 'Geralt of Rivia, a solitary monster hunter, struggles to find his place in a world where people often prove more wicked than beasts.', rating: '8.2', year: '2019', genre: 'Action, Adventure, Fantasy', type: 'series' },
];

const useMovies = () => {
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMovies(MOCK_MOVIES);
      setSeries(MOCK_SERIES);
      setTrending([...MOCK_MOVIES, ...MOCK_SERIES].slice(0, 10));
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return { movies, series, trending, loading, error };
};

export default useMovies;