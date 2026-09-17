# @title Import Europarl Utils functions. { display-mode: "form" }

import matplotlib.pyplot as plt
from abc import ABC, abstractmethod

import re
import os
import tarfile
import logging
import requests
from collections import Counter
import warnings

import random
from collections import Counter
import matplotlib.pyplot as plt
import nltk
from nltk.util import bigrams


import pandas as pd
import seaborn as sns
from mlcroissant import Dataset

import nltk
from nltk.tokenize import sent_tokenize, word_tokenize

import numpy as np

from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report
from sklearn.inspection import PartialDependenceDisplay
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.ensemble import RandomForestClassifier

from matplotlib.patches import Patch
from mpl_toolkits.axes_grid1 import make_axes_locatable

def load_data(languages=['en', 'de', 'nl']):

  dataset = EuroparlDataset(languages=languages)
  dataset = dataset.load_data()

  data_cleaner = EuroparlDataCleaner()

  data_processor = EuroparlDataProcessor(languages=languages)

  processed_data_1 = data_processor.process_dataframe(dataset, languages[0])
  processed_data_2 = data_processor.process_dataframe(dataset, languages[1])
  processed_data_3 = data_processor.process_dataframe(dataset, languages[2])

  return processed_data_1, processed_data_2, processed_data_3

def process_datasets(datasets, languages=['en', 'de', 'nl']):
      processed = []

      for idx, dataset in enumerate(datasets):
          print(f'Processing: {languages[idx]} -> label {idx}')
          #print(dataset.head(5))
          temp = dataset[
              ['num_uppercase_words', 'num_lowercase_words']
          ].copy()

          temp['label'] = idx

          processed.append(temp)

      classification_dataset = pd.concat(
          processed,
          ignore_index=True
      )

      classification_dataset['label'] = (
          classification_dataset['label']
          .astype(int)
      )

      return classification_dataset

def train_classifier(dataset, model, train_size=0.8):

        X = dataset[
            ['num_lowercase_words', 'num_uppercase_words']
        ]

        y = dataset['label']

        if train_size == 1:
          test_size = None
        else:
          test_size = float(1 - train_size)


        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size= test_size,
            random_state=42,
            shuffle=True,
            stratify=y
        )

        #print('\n\n Training Classifier...')
        #print('-------------------------')
        #print(f'Models to be trained: {model.__class__.__name__}')
        #print('-------------------------')

        #print(f'Training Model {model.__class__.__name__}...')

        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)

        accuracy = accuracy_score(
              y_test,
              y_pred
        )

        #print(f'Accuracy: {accuracy:.2%}')

        return model


class DataSource(ABC):
  @abstractmethod
  def load_data(self) -> pd.DataFrame:
    pass

class EuroparlDataset(DataSource):
  def __init__(self, languages: list=['en', 'de', 'nl'], save_path: str="data/europarl"):

    self.languages = [language for language in languages if language != 'en']
    self.save_path = save_path
    self.urls = [f"https://www.statmt.org/europarl/v7/{language}-en.tgz" for language in self.languages]
    self.filenames = [f"{language}.tgz" for language in self.languages]
    self.full_paths = [os.path.join(self.save_path, filename) for filename in self.filenames]

  def _ensure_directory(self):

    if not os.path.exists(self.save_path):
      os.makedirs(self.save_path)

  def _download(self):

    for url, full_path in zip(self.urls, self.full_paths):

      self._ensure_directory()
      if not os.path.exists(full_path):
        print(f"Downloading {url}...")
        response = requests.get(url, stream=True)
        with open(full_path, "wb") as f:
          for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
        print(f"Download of Europarl file finished.")

  def _extract_and_load(self) -> pd.DataFrame:

      dataframes = [pd.DataFrame(), pd.DataFrame()]

      for idx, full_path in enumerate(self.full_paths):

        with tarfile.open(full_path, "r:gz") as tar:
          files = tar.getnames()
          for target_file in files:

            column = target_file[-2:]

            print(f" Extracting: {target_file}")
            f = tar.extractfile(target_file)
            content = f.read().decode("utf-8").splitlines()[:1000]
            dataframes[idx][f'{column}'] = content

      dataframe = pd.merge(dataframes[0], dataframes[1], on='en')


      return dataframe

  def load_data(self)-> pd.DataFrame:

    self._download()
    return self._extract_and_load()


def _remove_punctuation(text: str) -> str:
  return re.sub(r'[^\w\s]', '', text)

class DataCleaner(ABC):
  @abstractmethod
  def clean_data(self, data: pd.DataFrame) -> pd.DataFrame:
    pass

class EuroparlDataCleaner(DataCleaner):
  def __init__(self, languages: list=['pt', 'en']):
    self.languages = languages

  def _count_words_starting_uppercase(self, text: str)  -> int:
    words = text.split()
    count = sum(1 for word in words if word[0].isupper())
    return count

  def _remove_punctuation(self, text: str) -> str:
    return re.sub(r'[^\w\s]', '', text)

  def clean_data(self, data: pd.DataFrame) -> pd.DataFrame:

    cleaned_dataset = pd.DataFrame()
    for column in data.columns:
      cleaned_dataset[column] = data[column].apply(lambda text: str.lower(str(text)))

    return cleaned_dataset

class DataProcessor(ABC):
  @abstractmethod
  def process_dataframe(self, data: pd.DataFrame) -> pd.DataFrame:
    pass

class EuroparlDataProcessor(DataProcessor):
  def __init__(self, languages: list=['pt', 'en', 'es']):
    self.languages = languages

  def _remove_punctuation(self, text: str) -> str:
    return re.sub(r'[^\w\s]', '', text)

  def _count_words_starting_uppercase(self, text: str)  -> int:
    words = text.split()
    count = sum(1 for word in words if word[0].isupper())
    return count

  def process_dataframe(self, df: pd.DataFrame, text_column: str) -> pd.DataFrame:
        print(f'Processing column: {text_column}')
        df['sentence_list'] = df[text_column].apply(sent_tokenize)

        df_sentences = df.explode('sentence_list').reset_index(drop=True)
        df_sentences = df_sentences.rename(columns={'sentence_list': 'sentence'})


        df_sentences = df_sentences[df_sentences['sentence'].str.strip().astype(bool)]

        df_sentences = df_sentences.dropna(subset=['sentence'])


        df_sentences['num_uppercase_words'] = df_sentences['sentence'].apply(self._count_words_starting_uppercase)
        df_sentences['sentence'] = df_sentences['sentence'].apply(lambda text: str.lower(str(text)))
        df_sentences['tokens'] = df_sentences['sentence'].astype(str).apply(self._remove_punctuation).apply(word_tokenize)
        df_sentences['word_count'] = df_sentences['tokens'].apply(len)
        df_sentences['num_lowercase_words'] = df_sentences['word_count'] - df_sentences['num_uppercase_words']
        df_sentences['uppercase_frequency'] = df_sentences['num_uppercase_words'] / df_sentences['word_count']

        df_sentences['avg_word_len'] = df_sentences['tokens'].apply(
            lambda words: sum(len(w) for w in words) / len(words) if len(words) > 0 else 0
        )

        df_sentences['char_count'] = df_sentences['sentence'].apply(len)

        return df_sentences

class EuropalDataVisualizer():
    def __init__(self, palette: list=["#3498db", "#e67e22", "#9b59b6"], aplha: float=0.5):
        self.palette = palette
        self.alpha = aplha

    def plot_bar_chart(self, df: pd.DataFrame, title: str):
      plt.figure(figsize=(15, 6), constrained_layout=True)
      ax = sns.barplot(data=df, palette=self.palette, alpha=self.alpha)
      for container in ax.containers:
          ax.bar_label(container, fmt='%.2f', padding=3)

      plt.title(title)
      plt.grid(True, axis='y', linestyle='--', alpha=0.7)

      sns.despine()

      plt.show()
      plt.close()

    def plot_histogram(self, df:  pd.DataFrame, title: str):


      for column, color in zip(df.columns, self.palette):

        plt.figure(figsize=(14.625,6), constrained_layout=True)

        sns.histplot(
            df[column],
            kde=False,
            color=color,
            label=column,
            alpha=self.alpha,
            edgecolor="white",
            shrink=0.8,
            linewidth=0.25
        )

        plt.title(title)
        plt.xlabel(column)
        plt.ylabel("Count")
        plt.legend()

        sns.despine()
        plt.grid(axis='y', alpha=0.3)
        plt.show()
        plt.close()


        plt.show()
        plt.close()

    def plot_scatter_plot(self,
                          df1: pd.DataFrame,
                          df2: pd.DataFrame,
                          df3: pd.DataFrame,
                          title: str,
                          label1: str,
                          label2: str,
                          label3: str,
                          column1: str,
                          column2: str
                          ):
        plt.figure(figsize=(12.165, 6), constrained_layout=True)

        sns.scatterplot(
            data=df1[[column1, column2]],
            x=column1,
            y=column2,
            label=label1,
            alpha=0.7,
            edgecolor=None,
            color=self.palette[0]
        )


        sns.scatterplot(
            data=df2[[column1, column2]],
            x=column1,
            y=column2,
            label=label2,
            alpha=0.3,
            edgecolor=None,
            color=self.palette[1]
        )

        sns.scatterplot(
            data=df3[[column1, column2]],
            x=column1,
            y=column2,
            label=label3,
            alpha=0.3,
            edgecolor=None,
            color=self.palette[2]
        )

        plt.grid(axis='y', alpha=0.3)
        plt.title(title, fontsize=16, pad=20)
        plt.xlabel(f"{column1}", fontsize=12)
        plt.ylabel(f'{column2}', fontsize=12)


        plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left', borderaxespad=0.)

        sns.despine()
        plt.tight_layout()
        plt.show()

    def plot_boxplot(self, df: pd.DataFrame,  title: str='Word Count'):

        plt.figure(figsize=(14.2, 6), constrained_layout=True)
        sns.boxplot(df, palette=self.palette, boxprops=dict(alpha=self.alpha), orient='v', )
        sns.despine()

        plt.title(title, fontsize=16, pad=20)
        plt.grid(True, axis='y', linestyle='--', alpha=0.7)
        plt.xlabel("Language", fontsize=12)
        plt.ylabel(title, fontsize=12)

        plt.show()

    def plot_most_frequent_words(self, df: pd.DataFrame, title:str, top_n: int=10):

        plt.figure(figsize=(12.165, 6), constrained_layout=True)

        ax = sns.barplot(x=df['words'], y=df['count'],  palette=["#3498db"])
        for container in ax.containers:
          ax.bar_label(container, fmt='%.3f', padding=3)

        plt.title(title, fontsize=18, pad=20)
        plt.grid(True, axis='y', linestyle='--', alpha=0.7)
        sns.despine()
        plt.xlabel('Words', fontsize=14)
        plt.ylabel('Frequency', fontsize=14)

        plt.tight_layout()
        plt.show()


class Classification(ABC):
  @abstractmethod
  def run_classification(self):
    pass

class EuroparlClassification(Classification):

    def __init__(
        self,
        df1: pd.DataFrame,
        df2: pd.DataFrame,
        df3: pd.DataFrame,
        languages: list = ['en', 'pt', 'es']
    ):

        self.languages = languages

        self.df1 = df1
        self.df2 = df2
        self.df3 = df3
        self.models = [
            DecisionTreeClassifier(max_depth=100),
            KNeighborsClassifier(n_neighbors=1),
            GaussianNB()
            ]
        self.dataset = self._process_datasets()

    def _plot_probability_heatmap_2(self, model):
        x_min, x_max = 0, 49
        y_min, y_max = 0, 29

        x_values = np.linspace(x_min, x_max, 150)
        y_values = np.linspace(y_min, y_max, 150)

        xx, yy = np.meshgrid(x_values, y_values)
        grid = pd.DataFrame(np.c_[xx.ravel(), yy.ravel()])

        proba = model.predict_proba(grid)

        color_0 = np.array([1.0, 1.0, 0.0])
        color_1 = np.array([1.0, 0.0, 0.0])
        color_2 = np.array([0.0, 0.0, 1.0])

        mixed_colors = (
            proba[:, [0]] * color_0 +
            proba[:, [1]] * color_1 +
            proba[:, [2]] * color_2
        )

        heatmap_image = mixed_colors.reshape(len(y_values), len(x_values), 3)

        fig, ax = plt.subplots(figsize=(10, 6), dpi=100)

        ax.imshow(
            heatmap_image,
            origin='lower',
            extent=[x_min, x_max, y_min, y_max],
            aspect='auto',
            interpolation='nearest'
        )

        legend_elements = [
            Patch(facecolor=color_0, label=f'{self.languages[0].upper()} (Yellow)'),
            Patch(facecolor=color_1, label=f'{self.languages[1].upper()} (Red)'),
            Patch(facecolor=color_2, label=f'{self.languages[2].upper()} (Blue)')
        ]
        ax.legend(
            handles=legend_elements,
            loc='upper right',
            title="Dominant Class",
            title_fontsize=12,
            prop={'size': 10},
            framealpha=1.0,
            facecolor='white',
            edgecolor='gray'
        )

        ax.set_title(f'Probability Heatmap - {model.__class__.__name__}', fontsize=14, pad=12)
        ax.set_xlabel('Num Lowercase Words', fontsize=11)
        ax.set_ylabel('Num Uppercase Words', fontsize=11)
        ax.tick_params(axis='both', labelsize=10)
        ax.set_xlim(x_min, x_max)
        ax.set_ylim(y_min, y_max)

        ax.grid(True, linestyle=':', alpha=0.3, color='white')

        plt.tight_layout()
        plt.show()

    def _process_datasets(self):

      datasets = [self.df1, self.df2, self.df3]

      processed = []

      for idx, dataset in enumerate(datasets):

          temp = dataset[
              ['num_uppercase_words', 'num_lowercase_words']
          ].copy()

          temp['label'] = idx

          processed.append(temp)

      classification_dataset = pd.concat(
          processed,
          ignore_index=True
      )

      classification_dataset['label'] = (
          classification_dataset['label']
          .astype(int)
      )

      return classification_dataset

    def _partial_dependency_plots(self, model):

      features = [
          ('num_lowercase_words', 'num_uppercase_words')
      ]


      for class_idx, language in enumerate(self.languages):
          fig = plt.figure(figsize=(10, 7))
          gs = fig.add_gridspec(1, 2, width_ratios=[23, 1], wspace=0.4)

          ax = fig.add_subplot(gs[0, 0])
          cax = fig.add_subplot(gs[0, 1])



          display = PartialDependenceDisplay.from_estimator(
              estimator=model,
              X=self.dataset[
                  ['num_lowercase_words', 'num_uppercase_words']
              ],
              features=features,
              target=class_idx,
              kind='average',
              grid_resolution=70,
              ax=ax
          )

          if display.contours_ is not None and len(display.contours_[0]) > 0:
            contour_quadmesh = display.contours_[0][0]
            ticks = np.linspace(0.0, 1.0, 6)

            cbar = fig.colorbar(
                contour_quadmesh,
                cax=cax,
                ticks=ticks,
                boundaries=np.linspace(0.0, 1.0, 100),
                shrink=0.6,
            )
            cbar.set_label('Partial Dependence (Probability)', rotation=270, labelpad=15)

          for axis in display.axes_.ravel():
              axis.grid(True)

          plt.suptitle(
              f'2D PDP - {language.upper()} - {model.__class__.__name__}'
          )

          plt.show()


    def _plot_regular_grid(self, model):

      grid = [(i, j) for i in range(50) for j in range(30)]
      grid = pd.DataFrame(grid)
      preds = model.predict(grid)

      fig, ax = plt.subplots(figsize=(10, 6))

      colors = plt.cm.get_cmap('viridis', len(self.languages))

      for class_idx, language in enumerate(self.languages):
          class_mask = (preds == class_idx)
          grid_class = grid[class_mask]

          ax.scatter(
              grid_class[0],
              grid_class[1],
              color=colors(class_idx),
              alpha=0.6,
              edgecolors='none',
              s=40,
              label=f'Predicted: {language.upper()}'
          )

      ax.set_title(f'Regular Grid Predictions - {model.__class__.__name__}')
      ax.set_xlabel('Num Lowercase Words')
      ax.set_ylabel('Num Uppercase Words')
      ax.grid(True, linestyle='--', alpha=0.5)
      ax.legend(loc='upper right')

      plt.tight_layout()
      plt.show()

    def _plot_probabilities(self, model):
      grid = [(i, j) for i in range(50) for j in range(30)]
      grid = pd.DataFrame(grid)
      proba = model.predict_proba(grid)

      color_0 = np.array([1.0, 1.0, 0.0]) # PT = Yellow
      color_1 = np.array([1.0, 0.0, 0.0]) # EN = Red
      color_2 = np.array([0.0, 0.0, 1.0]) # DE = Blue

      mixed_colors = np.zeros((len(grid), 3))

      for i in range(len(grid)):
          mixed_colors[i] = (
              proba[i, 0] * color_0 +
              proba[i, 1] * color_1 +
              proba[i, 2] * color_2
          )
      mixed_colors = np.clip(mixed_colors, 0.0, 1.0)

      fig, ax = plt.subplots(figsize=(10, 6))

      scatter = ax.scatter(
          grid[0],
          grid[1],
          c=mixed_colors,
          cmap='viridis',
          alpha=0.8,
          edgecolors='none',
          s=40
      )
      legend_elements = [
          Patch(facecolor=color_0, label=f'{self.languages[0].upper()} (Yellow)'),
          Patch(facecolor=color_1, label=f'{self.languages[1].upper()} (Red)'),
          Patch(facecolor=color_2, label=f'{self.languages[2].upper()} (Blue)')
      ]
      ax.legend(
          handles=legend_elements,
          loc='upper right',
          title="Dominant Class",
          framealpha=1.0,
          facecolor='white',
          edgecolor='gray'
      )


      ax.set_title(f'Regular Grid Probabilities - {model.__class__.__name__}')
      ax.set_xlabel('Num Lowercase Words')
      ax.set_ylabel('Num Uppercase Words')
      ax.grid(True, linestyle='--', alpha=0.5)

      plt.tight_layout()
      plt.show()

    def _plot_probability_heatmap(self, model):
      x_size = 50
      y_size = 30
      grid = [(i, j) for i in range(x_size) for j in range(y_size)]
      grid = pd.DataFrame(grid)

      proba = model.predict_proba(grid)

      color_0 = np.array([1.0, 1.0, 0.0])  # PT = Yellow
      color_1 = np.array([1.0, 0.0, 0.0])  # EN = Red
      color_2 = np.array([0.0, 0.0, 1.0])  # DE = Blue

      mixed_colors = (
          proba[:, [0]] * color_0 +
          proba[:, [1]] * color_1 +
          proba[:, [2]] * color_2
      )

      heatmap_image = mixed_colors.reshape(x_size, y_size, 3)

      heatmap_image = np.swapaxes(heatmap_image, 0, 1)


      fig, ax = plt.subplots(figsize=(10, 6))


      ax.imshow(
          heatmap_image,
          origin='lower',
          extent=[0, x_size - 1, 0, y_size - 1],
          aspect='auto',
          interpolation='nearest'
      )

      legend_elements = [
          Patch(facecolor=color_0, label=f'{self.languages[0].upper()} (Yellow)'),
          Patch(facecolor=color_1, label=f'{self.languages[1].upper()} (Red)'),
          Patch(facecolor=color_2, label=f'{self.languages[2].upper()} (Blue)')
      ]
      ax.legend(
          handles=legend_elements,
          loc='upper right',
          title="Dominant Class",
          framealpha=1.0,
          facecolor='white',
          edgecolor='gray'
      )

      ax.set_title(f'Probability Heatmap - {model.__class__.__name__}')
      ax.set_xlabel('Num Lowercase Words')
      ax.set_ylabel('Num Uppercase Words')
      ax.set_xlim(0, x_size - 1)
      ax.set_ylim(0, y_size - 1)
      ax.grid(True, linestyle='--', alpha=0.15, color='white')

      plt.tight_layout()
      plt.show()

    def run_classification(self):

        X = self.dataset[
            ['num_lowercase_words', 'num_uppercase_words']
        ]

        y = self.dataset['label']

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
            shuffle=True,
            stratify=y
        )

        model_summary = {
            'model': [],
            'accuracy': []
        }

        print('\n\nRunning classification...')
        print('-------------------------')

        for model in self.models:
          print(f'Models to be trained: {model.__class__.__name__}')
        print('-------------------------')

        for model in self.models:

          print(f'Training Model {model.__class__.__name__}...')

          model.fit(X_train, y_train)

          y_pred = model.predict(X_test)

          accuracy = accuracy_score(
              y_test,
              y_pred
          )

          print(f'Accuracy: {accuracy:.2%}')

          #self._partial_dependency_plots(model)
          #self._plot_regular_grid(model)
          #self._plot_probabilities(model)
          #self._plot_probability_heatmap(model)

          model_summary['model'].append(model)
          model_summary['accuracy'].append(accuracy)

        model_summary = pd.DataFrame(model_summary)
        model_summary.sort_values(by='accuracy', ascending=False, inplace=True)
        print(model_summary)

    def _plot_probability_heatmaps_changing_interpolation(self, model):

      x_size = 50
      y_size = 30
      grid = [(i, j) for i in range(x_size) for j in range(y_size)]
      grid = pd.DataFrame(grid)


      proba = model.predict_proba(grid)


      color_0 = np.array([1.0, 1.0, 0.0])
      color_1 = np.array([1.0, 0.0, 0.0])
      color_2 = np.array([0.0, 0.0, 1.0])

      mixed_colors = (
          proba[:, [0]] * color_0 +
          proba[:, [1]] * color_1 +
          proba[:, [2]] * color_2
      )


      heatmap_image = mixed_colors.reshape(x_size, y_size, 3)

      heatmap_image = np.swapaxes(heatmap_image, 0, 1)

      methods =  [ None, 'none', 'nearest', 'bilinear', 'bicubic', 'spline16',
           'spline36', 'hanning', 'hamming', 'hermite', 'kaiser', 'quadric',
           'catrom', 'gaussian', 'bessel', 'mitchell', 'sinc', 'lanczos']


      fig, axs = plt.subplots(nrows=3, ncols=6, figsize=(25, 16))

      for ax, method in zip(axs.flat, methods):


        ax.imshow(
            heatmap_image,
            origin='lower',
            extent=[0, x_size - 1, 0, y_size - 1],
            aspect='auto',
            interpolation=method
        )

        legend_elements = [
            Patch(facecolor=color_0, label=f'{self.languages[0].upper()} (Yellow)'),
            Patch(facecolor=color_1, label=f'{self.languages[1].upper()} (Red)'),
            Patch(facecolor=color_2, label=f'{self.languages[2].upper()} (Blue)')
        ]
        ax.legend(
            handles=legend_elements,
            loc='upper right',
            title="Dominant Class",
            framealpha=1.0,
            facecolor='white',
            edgecolor='gray'
        )

        ax.set_title(f'{method}')
        ax.set_xlabel('Num Lowercase Words')
        ax.set_ylabel('Num Uppercase Words')
        ax.set_xlim(0, x_size - 1)
        ax.set_ylim(0, y_size - 1)
        ax.grid(True, linestyle='--', alpha=0.15, color='white')

        plt.tight_layout()
      plt.show()

def plot_language_top_bigrams(lang_df, lang_code, top_n=10):
    color_map = {"en": "#3498db", "de": "#e67e22", "nl": "#2ecc71"}
    bar_color = color_map.get(lang_code, "#9b59b6")

    if lang_df.empty or "sentence" not in lang_df.columns:
        print(f"Aviso: Coluna 'sentence' não encontrada no DataFrame do idioma '{lang_code}'.")
        return

    lang_text = " ".join(lang_df["sentence"].dropna().astype(str))

   
    tokens = [
        word.lower() for word in nltk.word_tokenize(lang_text) if word.isalnum()
    ]


    try:
        stop_words = set(nltk.corpus.stopwords.words(lang_code))
        tokens = [t for t in tokens if t not in stop_words]
    except Exception:
        pass

   
    lang_bigrams = list(bigrams(tokens))
    bigram_counts = Counter(lang_bigrams).most_common(top_n)

    if not bigram_counts:
        print(f"Nenhum bigrama encontrado para {lang_code}.")
        return

    labels = [f"{bg[0]} {bg[1]}" for bg, _ in bigram_counts]
    counts = [count for _, count in bigram_counts]


    plt.figure(figsize=(12, 6), constrained_layout=True)
    bars = plt.bar(labels, counts, color=bar_color, alpha=0.85, edgecolor="black")

    max_freq = max(counts)
    min_freq = min(counts)

    for bar, count in zip(bars, counts):
        height = bar.get_height()
        font_size = 12 if max_freq == min_freq else 10 + (count - min_freq) / (max_freq - min_freq) * 8

        plt.text(
            bar.get_x() + bar.get_width() / 2.0,
            height + (max_freq * 0.01),
            f"{count}",
            ha="center",
            va="bottom",
            fontsize=font_size,
            fontweight="bold",
        )

    plt.title(f"Top {top_n} Bigramas mais Frequentes - {lang_code.upper()}", fontsize=16, pad=15)
    plt.xlabel("Bigramas", fontsize=12)
    plt.ylabel("Frequência", fontsize=12)
    plt.xticks(rotation=30, ha="right", fontsize=11)
    plt.grid(True, axis="y", linestyle="--", alpha=0.5)

    ax = plt.gca()
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    plt.show()
    plt.close()

def plot_graph():

    plt.figure()
    plt.plot([5, 0, 1], [5, 4, 1], color='green')
    plt.title('Graph 1 -- ')

import pandas as pd

import pandas as pd
from collections import Counter
import nltk
from nltk.util import bigrams

def export_bigrams_to_csv(datasets, languages, top_n=10):

    for lang_df, lang_code in zip(datasets, languages):
        if lang_df.empty or "sentence" not in lang_df.columns:
            print(f"Aviso: Coluna 'sentence' não encontrada para '{lang_code}'.")
            continue

        lang_text = " ".join(lang_df["sentence"].dropna().astype(str))

        tokens = [
            word.lower() for word in nltk.word_tokenize(lang_text) if word.isalnum()
        ]

        try:
            stop_words = set(nltk.corpus.stopwords.words(lang_code))
            tokens = [t for t in tokens if t not in stop_words]
        except Exception:
            pass

        lang_bigrams = list(bigrams(tokens))
        bigram_counts = Counter(lang_bigrams).most_common(top_n)

        if not bigram_counts:
            print(f"Nenhum bigrama encontrado para {lang_code}.")
            continue

        df_csv = pd.DataFrame({
            "bigram": [f"{bg[0]} {bg[1]}" for bg, _ in bigram_counts],
            "frequency": [count for _, count in bigram_counts],
            "language": lang_code
        })

        filename = f"bigrams_{lang_code}.csv"
        df_csv.to_csv(filename, index=False, encoding="utf-8")

def load_default_dataset():

    nltk.download('punkt', quiet=True)
    nltk.download('punkt_tab', quiet=True)
    nltk.download('stopwords', quiet=True)

    context = {}
    languages = ['en', 'de', 'nl']
    
    datasets = load_data(languages=languages) 
    
    context['dataset'] = process_datasets(datasets, languages)
    context['languages'] = languages

    X = context['dataset'][['num_uppercase_words', 'num_lowercase_words']]
    y = context['dataset']['label']

    print(datasets)

    #plot_language_top_bigrams(lang_df=datasets[0], lang_code=languages[0], top_n=5)
    export_bigrams_to_csv(datasets=datasets, languages=languages, top_n=10)

    return datasets