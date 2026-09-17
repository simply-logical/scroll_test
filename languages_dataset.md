````{dynamic-images-scrollytelling}
:title: Languages Dataset
:imgWidth: 350px

```python
import matplotlib.pyplot as plt
import pandas as pd
from languages_dataset import *

datasets = load_default_dataset()
data = pd.read_csv('bigrams_en.csv')
plt.bar(data['bigram'][:5], data['frequency'][:5])
plt.title('Bigrams - English')
plt.xticks(rotation=45, ha="right", fontsize=11)
plt.show()

```

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

```python
import matplotlib.pyplot as plt
import pandas as pd
from languages_dataset import *

datasets = load_default_dataset()
data = pd.read_csv('bigrams_de.csv')
plt.bar(data['bigram'][:5], data['frequency'][:5])
plt.title('Bigrams - German')
plt.xticks(rotation=45, ha="right", fontsize=11)
plt.show()
```

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

```python
import matplotlib.pyplot as plt
import pandas as pd
from languages_dataset import *

datasets = load_default_dataset()
data = pd.read_csv('bigrams_nl.csv')
plt.bar(data['bigram'][:5], data['frequency'][:5])
plt.title('Bigrams - Dutch')
plt.xticks(rotation=45, ha="right", fontsize=11)
plt.show()
```

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.