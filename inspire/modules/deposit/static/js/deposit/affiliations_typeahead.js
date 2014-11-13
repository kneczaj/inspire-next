/*
 * This file is part of INSPIRE.
 * Copyright (C) 2014 CERN.
 *
 * INSPIRE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * INSPIRE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with INSPIRE. If not, see <http://www.gnu.org/licenses/>.
 *
 * In applying this licence, CERN does not waive the privileges and immunities
 * granted to it by virtue of its status as an Intergovernmental Organization
 * or submit itself to any jurisdiction.
 */

define([
  'jquery',
  'js/jquery_plugin',
], function($, jQueryPlugin) {

  /**
   * Removes non alpha-numeric characters from beginning and end of a string.
   *
   * @param str {String} input string
   * @returns {String} trimmed string
   * @private
   */
  function _trimNonAlphaNumericChar(str) {
    return str.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/ig, '');
  }

   /**
   * Tokenizer used by the bloodhound engine
   *
   * @param datum {Object} an item returned by query
   * @returns {Array} array of tokens; the result query is a one consisting of queries
   *   for every token connected with OR operator
   */
  function datumTokenizer(datum) {
    if ((typeof datum) === 'string') {
      return [datum];
    }
    var tokens = [];
    if (datum.name && (typeof datum.name) === 'string') {
      var titleNameTokens = datum.name.split(/\s+/);
      titleNameTokens = $.map(titleNameTokens, _trimNonAlphaNumericChar);
      tokens = tokens.concat(titleNameTokens);
    }
    if (datum.affiliation && (typeof datum.affiliation) === 'string') {
      tokens = tokens.concat(datum.place.split(/,?\s+/));
    }
    return tokens;
  }

  function AffiliationsTypeahead($element) {

    this.dataEngine = new Bloodhound({
      name: 'affiliations',
      remote: {
        url: '/search?cc=Institutions&p=%QUERY*&of=recjson&f=affautocomplete',
        // replace: function(url, query) {
        //   return url.replace('%QUERY', query);
        // },
        filter: function(response) {
          return $.map(response, function(item, idx) {
            return item.institution;
          });
        }
      },
      datumTokenizer: datumTokenizer,
      queryTokenizer: Bloodhound.tokenizers.whitespace,
      limit: 100,
    });

    this.dataEngine.initialize();
    this.$element = $element;

    var suggestionTemplate = Hogan.compile(
      '<b>{{ affiliation }}</b><br>' +
      '<small>' +
      '{{#department}}Department: {{ department }}<br>{{/department}}' +
      '{{#name}}{{ name }}{{/name}}' +
      '</small>'
    );

    this.$element.typeahead({
      minLength: 3
    }, {
      // after typeahead upgrade to 0.11 can be substituted with:
      // source: this.engine.ttAdapter(),
      // https://github.com/twitter/typeahead.js/issues/166
      source: function(query, callback) {
        // trigger can be deleted after typeahead upgrade to 0.11
        this.$element.trigger('typeahead:asyncrequest');
        this.dataEngine.get(query, function(suggestions) {
          this.$element.trigger('typeahead:asyncreceive');
          callback(suggestions);
        }.bind(this));
      }.bind(this),
      // the key of a value which is rather passed to typeahead than displayed
      // the display values are selected by templates.
      displayKey: 'affiliation',
      templates: {
        empty: function(data) {
          return 'Cannot find this affiliation in our database.';
        },
        suggestion: function(data) {
          return suggestionTemplate.render.call(suggestionTemplate, data);
        }.bind(this)
      }
    });

    return $element;
  }

  $.fn.affiliationsTypeahead = jQueryPlugin(AffiliationsTypeahead, 'affiliation-typeahead');

  return AffiliationsTypeahead;
});
